"use server";

import { createClient } from "@/lib/supabase/server";
import { inChunks, readAll } from "@/lib/supabase/read-all";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import type { ExcelRow } from "@/lib/excel";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { productSchema, ProductFormValues, bulkProductUpdateSchema, type BulkProductUpdate } from "@/lib/validations/master-data";

export async function getProducts() {
  const supabase = await createClient();
  // 1.000 satır sınırına takılmadan tüm aktif ürünler
  return readAll(
    (from, to) => supabase.from("products").select("*").eq("active", true).order("name").order("id").range(from, to),
    "Ürünler getirilirken bir hata oluştu",
  );
}

/** Silinen (pasife alınmış) ürünler — geri alma listesi */
export async function getDeletedProducts() {
  const supabase = await createClient();
  return readAll(
    (from, to) => supabase.from("products").select("*").eq("active", false).order("name").order("id").range(from, to),
    "Silinen ürünler getirilirken bir hata oluştu",
  );
}

/** Silinen ürünleri geri alır (tekrar aktif yapar). */
export async function restoreProducts(ids: string[]) {
  await requirePermission("master-data:write");
  if (ids.length === 0) throw new Error("Ürün seçilmedi.");
  const supabase = await createClient();
  const restored = await inChunks(ids, 200, (chunk) => supabase.from("products").update({ active: true }).in("id", chunk).select("id"));
  revalidatePath("/ana-veri");
  return restored.length;
}

export async function saveProduct(data: ProductFormValues) {
  const supabase = await createClient();
  const parsed = productSchema.safeParse(data);
  
  if (!parsed.success) {
    throw new Error("Geçersiz form verisi.");
  }
  
  const payload = parsed.data;

  // Insert or Update
  if (payload.id) {
    const { error } = await supabase
      .from("products")
      .update({
        code: payload.code,
        name: payload.name,
        type: payload.type,
        unit: payload.unit,
        category: payload.category || null,
        material_grade: payload.material_grade || null,
        material_group: payload.material_group ? payload.material_group.toUpperCase() : null,
        diameter_mm: payload.diameter_mm ?? null,
        sdr: payload.sdr ?? null,
        wall_thickness_mm: payload.wall_thickness_mm ?? null,
        group_code: payload.group_code || null,
        variant_code: payload.variant_code ? payload.variant_code.toUpperCase() : null,
        description: payload.description || null,
        bag_type: payload.bag_type || null,
        bag_qty: payload.bag_qty ?? null,
        package_type: payload.package_type || null,
        package_qty: payload.package_qty ?? null,
        pallet_qty: payload.pallet_qty ?? null,
        pipe_length_m: payload.pipe_length_m ?? null,
        package_weight_kg: payload.package_weight_kg ?? null,
        barcode: payload.barcode || null,
        package_note: payload.package_note || null,
        min_stock: payload.min_stock,
        critical_stock: payload.critical_stock,
      })
      .eq("id", payload.id);
      
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("products")
      .insert([{
        code: payload.code,
        name: payload.name,
        type: payload.type,
        unit: payload.unit,
        category: payload.category || null,
        material_grade: payload.material_grade || null,
        material_group: payload.material_group ? payload.material_group.toUpperCase() : null,
        diameter_mm: payload.diameter_mm ?? null,
        sdr: payload.sdr ?? null,
        wall_thickness_mm: payload.wall_thickness_mm ?? null,
        group_code: payload.group_code || null,
        variant_code: payload.variant_code ? payload.variant_code.toUpperCase() : null,
        description: payload.description || null,
        bag_type: payload.bag_type || null,
        bag_qty: payload.bag_qty ?? null,
        package_type: payload.package_type || null,
        package_qty: payload.package_qty ?? null,
        pallet_qty: payload.pallet_qty ?? null,
        pipe_length_m: payload.pipe_length_m ?? null,
        package_weight_kg: payload.package_weight_kg ?? null,
        barcode: payload.barcode || null,
        package_note: payload.package_note || null,
        min_stock: payload.min_stock,
        critical_stock: payload.critical_stock,
      }]);
      
    if (error) throw new Error(error.message);
  }

  revalidatePath("/ana-veri");
}

export async function deleteProduct(id: string) {
  const supabase = await createClient();
  // Soft delete
  const { error } = await supabase
    .from("products")
    .update({ active: false })
    .eq("id", id);
    
  if (error) throw new Error(error.message);
  
  revalidatePath("/ana-veri");
}

export async function bulkDeleteProducts(ids: string[]) {
  const supabase = await createClient();
  // Soft delete
  const { error } = await supabase
    .from("products")
    .update({ active: false })
    .in("id", ids);
    
  if (error) throw new Error("Toplu silme başarısız: " + error.message);
  
  revalidatePath("/ana-veri");
}

/** Seçili ürünlerde tek bir özelliği toplu atar ya da temizler (value = null). */
export async function bulkUpdateProducts(ids: string[], update: BulkProductUpdate) {
  await requirePermission("master-data:write");
  const parsed = bulkProductUpdateSchema.safeParse(update);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz değer.");
  if (ids.length === 0) throw new Error("Ürün seçilmedi.");
  const { field, value } = parsed.data;
  const supabase = await createClient();
  const patch = { [field]: value } as TablesUpdate<"products">;
  const updated = await inChunks(ids, 200, (chunk) => supabase.from("products").update(patch).in("id", chunk).select("id"));
  revalidatePath("/ana-veri");
  return updated.length;
}

export async function bulkImportProducts(productsData: ExcelRow[]) {
  const supabase = await createClient();
  
  // Basic validation mapping
  const payload = productsData.map(p => {
    const code = String(p["STOK KODU"] || p.Kodu || p.KOD || p.Code || "").trim();
    const name = String(p["STOK ADI"] || p.Adi || p.AD || p.Name || "").trim();
    const type = String(p["STOK TİPİ"] || p.Tipi || p.TİP || "finished").trim().toLowerCase();
    const unit = String(p["BİRİM"] || p.Birimi || p.Birim || "adet").trim().toLowerCase();
    const category = p.Kategori ? String(p.Kategori).trim() : null;
    const material_grade = p.MalzemeSinifi ? String(p.MalzemeSinifi).trim() : null;
    const min_stock = Number(p.MinStok) || 0;
    const critical_stock = Number(p.KritikStok) || 0;
    
    let rawCost = String(p.BirimMaliyet || p["BİRİM MALİYET"] || p.Fiyat || p.FİYAT || p.FIYAT || p["FİYAT"] || 0);
    rawCost = rawCost.replace(',', '.').replace(/[^0-9.]/g, '');
    const unit_cost = Number(rawCost) || 0;

    const rawCurrency = String(p.Doviz || p.Döviz || p.DÖVİZ || p.ParaBirimi || p["PARA BİRİMİ"] || "TRY").trim().toUpperCase();
    
    let mappedCurrency = "TRY";
    if (rawCurrency.includes("USD") || rawCurrency.includes("$")) mappedCurrency = "USD";
    else if (rawCurrency.includes("EUR") || rawCurrency.includes("€") || rawCurrency.includes("EURO")) mappedCurrency = "EUR";

    // Type mapping for Turkish inputs
    let mappedType = type;
    if (type.includes("hammadde")) mappedType = "raw";
    else if (type.includes("yarı mamul") || type.includes("yari mamul") || type.includes("yarı mamül") || type.includes("yari mamül")) mappedType = "semi";
    else if (type.includes("hurda") || type.includes("fire") || type.includes("fi̇re")) mappedType = "scrap";
    else if (type.includes("mamul") || type.includes("mamül") || type.includes("ürün")) mappedType = "finished";

    // Unit mapping for Turkish inputs
    let mappedUnit = "adet"; // default
    if (unit.includes("kg") || unit.includes("kilogram") || unit.includes("ki̇logram")) mappedUnit = "kg";
    else if (unit.includes("metre") || unit.includes("mt")) mappedUnit = "metre";
    else if (unit.includes("adet") || unit.includes("ad")) mappedUnit = "adet";

    return {
      code,
      name,
      type: mappedType,
      unit: mappedUnit,
      category,
      material_grade,
      min_stock,
      critical_stock,
      unit_cost,
      currency: mappedCurrency,
    };
  }).filter(p => p.code && p.name);

  if (payload.length === 0) {
    throw new Error("Geçerli ürün bulunamadı. Lütfen 'Kodu' veya 'STOK KODU' sütunlarını kontrol edin.");
  }

  // Deduplicate payload by code (keep the last occurrence in case of duplicates)
  const uniquePayloadMap = new Map();
  payload.forEach(item => {
    uniquePayloadMap.set(item.code, item);
  });
  const deduplicatedPayload = Array.from(uniquePayloadMap.values());

  // Insert all in one go (Upsert updates existing records with the same code)
  const { error } = await supabase
    .from("products")
    .upsert(deduplicatedPayload, { onConflict: "code" });

  if (error) {
    throw new Error("Toplu içe aktarım sırasında hata: " + error.message);
  }

  revalidatePath("/ana-veri");
  return payload.length;
}

export type ProductRow = Awaited<ReturnType<typeof getProducts>>[number];

/** Grup kodu tanımları (kod → ad) */
export async function getProductGroups() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_groups").select("code, name").order("code");
  if (error) throw new Error("Grup kodları getirilirken hata oluştu: " + error.message);
  return data;
}

/** Grup kodu adı ekler / değiştirir. */
export async function saveProductGroup(code: string, name: string) {
  await requirePermission("master-data:write");
  const c = code.trim();
  const n = name.trim();
  if (!c) throw new Error("Grup kodu zorunludur.");
  if (!n) throw new Error("Grup adı zorunludur.");
  if (c.length > 20 || n.length > 120) throw new Error("Kod en fazla 20, ad en fazla 120 karakter olabilir.");
  const supabase = await createClient();
  const { error } = await supabase.from("product_groups").upsert({ code: c, name: n }, { onConflict: "code" });
  if (error) throw new Error(error.message);
  revalidatePath("/ana-veri");
}

/** Grup kodu adını siler; ürünlerdeki grup kodu değeri kalır. */
export async function deleteProductGroup(code: string) {
  await requirePermission("master-data:write");
  const supabase = await createClient();
  const { error } = await supabase.from("product_groups").delete().eq("code", code);
  if (error) throw new Error(error.message);
  revalidatePath("/ana-veri");
}
