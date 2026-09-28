"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  stockMovementSchema,
  StockMovementFormValues,
  stockDocumentSchema,
  StockDocumentFormValues,
} from "@/lib/validations/stock";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import type { Enums, TablesInsert } from "@/lib/supabase/database.types";

export async function getStockOverview() {
  const supabase = await createClient();
  
  // 1. Tüm aktif ürünleri getir
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, code, name, type, unit, min_stock, critical_stock")
    .eq("active", true)
    .order("code", { ascending: true });

  if (productsError) throw new Error("Ürünler getirilirken hata oluştu: " + productsError.message);

  // 2. Stok bakiyeleri (v_stock) ve depolar
  const [{ data: stocks, error: stockError }, { data: warehouses, error: warehouseError }] = await Promise.all([
    supabase.from("v_stock").select("product_id, warehouse_id, qty"),
    supabase.from("warehouses").select("id, name, type"),
  ]);

  if (stockError) throw new Error("Stok verileri getirilirken hata oluştu: " + stockError.message);
  if (warehouseError) throw new Error("Depolar getirilirken hata oluştu: " + warehouseError.message);

  const warehouseById = new Map(warehouses.map((w) => [w.id, w]));
  const stocksByProduct = new Map<string, typeof stocks>();
  for (const s of stocks) {
    if (!s.product_id) continue;
    const list = stocksByProduct.get(s.product_id) ?? [];
    list.push(s);
    stocksByProduct.set(s.product_id, list);
  }

  // 3. Ürün başına her depo için bir satır; hiç hareketi olmayan ürün 0 ile listelenir
  return products.flatMap((product) => {
    const productStocks = stocksByProduct.get(product.id);
    if (!productStocks) return [{ product, warehouse: null, qty: 0 }];
    return productStocks.map((s) => ({
      product,
      warehouse: (s.warehouse_id && warehouseById.get(s.warehouse_id)) || null,
      qty: Number(s.qty ?? 0),
    }));
  });
}

export type StockOverviewRow = Awaited<ReturnType<typeof getStockOverview>>[number];

export async function getStockMovements(limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .select(`
      *,
      product:products(code, name, unit),
      warehouse:warehouses(name),
      user:profiles(name)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error("Stok hareketleri getirilirken hata oluştu: " + error.message);

  // Ters kaydı yapılmış hareketleri işaretle
  const ids = data.map((m) => m.id);
  const { data: reversals } = ids.length
    ? await supabase.from("stock_movements").select("reverses_id").in("reverses_id", ids)
    : { data: [] };
  const reversed = new Set((reversals ?? []).map((r) => r.reverses_id));

  return data.map((m) => ({ ...m, is_reversed: reversed.has(m.id) }));
}

export async function saveStockMovement(data: StockMovementFormValues) {
  const supabase = await createClient();
  
  const user = await getCurrentUser();
  if (!user) throw new Error("Oturum bulunamadı.");
  if (!hasPermission("stock:write", user.role)) {
    throw new Error(`Manuel stok girişi yapmak için Depo veya Admin yetkisine sahip olmalısınız. (Mevcut rolünüz: ${user.role})`);
  }

  const parsed = stockMovementSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Geçersiz form verisi.");
  }
  
  const payload = parsed.data;

  const { error } = await supabase
    .from("stock_movements")
    .insert([{
      product_id: payload.product_id,
      warehouse_id: payload.warehouse_id,
      direction: payload.direction,
      quantity: payload.quantity,
      lot_no: payload.lot_no || null,
      source_type: payload.source_type,
      note: payload.note || null,
      user_id: user.id
    }]);

  if (error) throw new Error(error.message);

  revalidatePath("/depo");
  revalidatePath("/depo/hareketler");
  return true;
}

/**
 * Stok hareketleri silinmez (append-only). Seçilen hareketler için
 * karşı yönde ters kayıt eklenir; yetki kontrolü veritabanı RLS'inde.
 * @returns Ters çevrilen hareket sayısı
 */
export async function reverseStockMovements(ids: string[]) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Oturum bulunamadı.");

  const { data, error } = await supabase.rpc("reverse_stock_movements", { p_ids: ids });
  if (error) throw new Error("Ters kayıt yapılamadı: " + error.message);

  revalidatePath("/depo");
  revalidatePath("/depo/hareketler");
  return data as number;
}

export async function getStockDocuments(limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_documents")
    .select(`
      *,
      source:warehouses!source_warehouse_id(name),
      target:warehouses!target_warehouse_id(name),
      user:profiles!stock_documents_user_id_fkey(name)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error("Stok fişleri getirilirken hata oluştu: " + error.message);
  return data;
}

export async function getStockDocumentById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_documents")
    .select(`
      *,
      source:warehouses!source_warehouse_id(name),
      target:warehouses!target_warehouse_id(name),
      user:profiles!stock_documents_user_id_fkey(name),
      items:stock_movements(
        id, product_id, quantity, lot_no, note, direction,
        product:products(code, name, unit)
      )
    `)
    .eq("id", id)
    .single();

  if (error) throw new Error("Stok fişi getirilirken hata oluştu: " + error.message);
  return data;
}

const DOCUMENT_SOURCE_TYPE: Record<StockDocumentFormValues["type"], Enums<"movement_source_type">> = {
  in_purchase: "purchase",
  in_production: "production",
  in_count: "count",
  transfer: "transfer",
  out_sale: "sale",
  out_consumption: "production",
  out_scrap: "scrap",
  out_count: "count",
};

export async function saveStockDocument(data: StockDocumentFormValues) {
  const supabase = await createClient();

  const user = await getCurrentUser();
  if (!user) throw new Error("Oturum bulunamadı.");
  if (!hasPermission("stock:write", user.role)) {
    throw new Error("Stok fişi oluşturmak için Depo veya Admin yetkisine sahip olmalısınız.");
  }

  const parsed = stockDocumentSchema.safeParse(data);
  if (!parsed.success) throw new Error("Geçersiz fiş verisi.");
  const payload = parsed.data;

  // Depo kontrolleri başlık kaydından ÖNCE: yarım fiş oluşmasın
  const isTransfer = payload.type === "transfer";
  const direction: Enums<"movement_direction"> = payload.type.startsWith("in_") ? "in" : "out";
  if (isTransfer && (!payload.source_warehouse_id || !payload.target_warehouse_id)) {
    throw new Error("Transfer fişinde hem kaynak hem hedef depo seçilmelidir.");
  }
  const warehouseId = direction === "in" ? payload.target_warehouse_id : payload.source_warehouse_id;
  if (!isTransfer && !warehouseId) throw new Error("İlgili depo seçilmelidir.");

  // Generate a document number if not provided
  let docNo = payload.no;
  if (!docNo) {
    const prefix = payload.type.includes("transfer") ? "TRF" : payload.type.includes("in_") ? "GIR" : "CIK";
    docNo = `${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // 1. Insert header
  const { data: docData, error: docError } = await supabase
    .from("stock_documents")
    .insert([{
      no: docNo,
      type: payload.type,
      document_date: payload.document_date,
      source_warehouse_id: payload.source_warehouse_id || null,
      target_warehouse_id: payload.target_warehouse_id || null,
      note: payload.note || null,
      user_id: user.id
    }])
    .select()
    .single();

  if (docError) throw new Error("Fiş kaydedilemedi: " + docError.message);

  // 2. Insert items (movements)
  const sourceType = DOCUMENT_SOURCE_TYPE[payload.type];
  const movementsToInsert: TablesInsert<"stock_movements">[] = payload.items.flatMap((item) => {
    const base = {
      document_id: docData.id,
      product_id: item.product_id,
      quantity: item.quantity,
      lot_no: item.lot_no || null,
      source_type: sourceType,
      note: item.note || null,
      user_id: user.id,
    };
    // Transfer: kaynaktan çıkış + hedefe giriş
    if (isTransfer) {
      return [
        { ...base, warehouse_id: payload.source_warehouse_id!, direction: "out" as const },
        { ...base, warehouse_id: payload.target_warehouse_id!, direction: "in" as const },
      ];
    }
    return [{ ...base, warehouse_id: warehouseId!, direction }];
  });

  const { error: moveError } = await supabase
    .from("stock_movements")
    .insert(movementsToInsert);

  if (moveError) {
    // Fişler silinmez: kalemsiz kalan başlığı iptal olarak işaretle
    await supabase
      .from("stock_documents")
      .update({ cancelled_at: new Date().toISOString(), cancelled_by: user.id })
      .eq("id", docData.id);
    throw new Error("Fiş kalemleri kaydedilemedi: " + moveError.message);
  }

  revalidatePath("/depo");
  revalidatePath("/depo/hareketler");
  revalidatePath("/depo/fisler");
  return true;
}

/**
 * Fiş silinmez; iptal edilir. Fiş iptal olarak işaretlenir ve tüm
 * hareketleri tek işlemde ters kayıtla geri alınır.
 */
export async function cancelStockDocument(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Oturum bulunamadı.");

  const { error } = await supabase.rpc("cancel_stock_document", { p_id: id });
  if (error) throw new Error("Fiş iptal edilemedi: " + error.message);

  revalidatePath("/depo");
  revalidatePath("/depo/hareketler");
  revalidatePath("/depo/fisler");
}

export type StockMovementRow = Awaited<ReturnType<typeof getStockMovements>>[number];

export type StockDocumentRow = Awaited<ReturnType<typeof getStockDocuments>>[number];
