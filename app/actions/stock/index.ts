"use server";

import { isNotFound, isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";
import { readAll } from "@/lib/supabase/read-all";
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

  // Ürünler, bakiyeler ve depolar (1.000 satır sınırına takılmadan)
  const [products, stocks, { data: warehouses, error: warehouseError }] = await Promise.all([
    readAll(
      (f, t) =>
        supabase
          .from("products")
          .select("id, code, name, type, unit, category, group_code, material_group, min_stock, critical_stock")
          .eq("active", true)
          .order("code", { ascending: true })
          .order("id")
          .range(f, t),
      "Ürünler getirilirken hata oluştu",
    ),
    readAll((f, t) => supabase.from("v_stock").select("product_id, warehouse_id, qty").order("product_id").order("warehouse_id").range(f, t), "Stok verileri getirilirken hata oluştu"),
    supabase.from("warehouses").select("id, name, type").order("name"),
  ]);
  if (warehouseError) throw new Error("Depolar getirilirken hata oluştu: " + warehouseError.message);

  const warehouseById = new Map(warehouses.map((w) => [w.id, w]));
  const stocksByProduct = new Map<string, typeof stocks>();
  for (const s of stocks) {
    if (!s.product_id) continue;
    const list = stocksByProduct.get(s.product_id) ?? [];
    list.push(s);
    stocksByProduct.set(s.product_id, list);
  }

  // Ürün başına her depo için bir satır; hiç hareketi olmayan ürün 0 ile listelenir
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

/** Depo filtresi için depo listesi */
export async function getWarehouseOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("warehouses").select("id, name, type").order("name");
  if (error) throw new Error("Depolar getirilirken hata oluştu: " + error.message);
  return data;
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
  if (!isUuid(id)) return null;
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

  if (isNotFound(error)) return null;
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
  return docData.id as string;
}

/**
 * Fiş silinmez; iptal edilir. Fiş iptal olarak işaretlenir ve tüm
 * hareketleri tek işlemde ters kayıtla geri alınır.
 */
export async function cancelStockDocument(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Oturum bulunamadı.");

  // Sevk irsaliyesine ait fiş irsaliyeden iptal edilir (irsaliye de iptal görünsün)
  const { data: shipment } = await supabase.from("shipments").select("no").eq("document_id", id).maybeSingle();
  if (shipment) throw new Error(`Bu fiş ${shipment.no} sevk irsaliyesine ait; Siparişler → Sevkiyatlar'dan irsaliyeyi iptal edin.`);

  const { error } = await supabase.rpc("cancel_stock_document", { p_id: id });
  if (error) throw new Error("Fiş iptal edilemedi: " + error.message);

  revalidatePath("/depo");
  revalidatePath("/depo/hareketler");
  revalidatePath("/depo/fisler");
}

export type StockMovementRow = Awaited<ReturnType<typeof getStockMovements>>[number];

export type StockDocumentRow = Awaited<ReturnType<typeof getStockDocuments>>[number];

/**
 * Regrind ve hurda stokları grade (products.material_grade) bazında.
 * Grade = ayrı ürün kartı; grade girilmemiş ürünler "Grade belirtilmemiş" altında toplanır.
 */
export async function getRegrindScrapByGrade() {
  const supabase = await createClient();
  const [{ data: products, error }, { data: stocks, error: stockError }] = await Promise.all([
    supabase.from("products").select("id, code, name, type, material_grade").in("type", ["regrind", "scrap"]),
    supabase.from("v_stock").select("product_id, qty"),
  ]);
  if (error) throw new Error("Regrind/hurda ürünleri getirilirken hata oluştu: " + error.message);
  if (stockError) throw new Error("Stok verileri getirilirken hata oluştu: " + stockError.message);

  const qtyByProduct = new Map<string, number>();
  for (const s of stocks) {
    if (s.product_id) qtyByProduct.set(s.product_id, (qtyByProduct.get(s.product_id) ?? 0) + Number(s.qty ?? 0));
  }

  const groups = new Map<string, { grade: string; regrindKg: number; scrapKg: number; products: { code: string; name: string; type: string; qty: number }[] }>();
  for (const p of products) {
    const qty = qtyByProduct.get(p.id) ?? 0;
    if (qty === 0) continue;
    const grade = p.material_grade?.trim() || "Grade belirtilmemiş";
    const g = groups.get(grade) ?? { grade, regrindKg: 0, scrapKg: 0, products: [] };
    if (p.type === "regrind") g.regrindKg += qty;
    else g.scrapKg += qty;
    g.products.push({ code: p.code, name: p.name, type: p.type, qty });
    groups.set(grade, g);
  }
  return [...groups.values()].sort((a, b) => b.regrindKg + b.scrapKg - (a.regrindKg + a.scrapKg));
}

export type RegrindScrapGroup = Awaited<ReturnType<typeof getRegrindScrapByGrade>>[number];
