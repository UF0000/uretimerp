"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ExcelRow } from "@/lib/excel";
import { productSchema, ProductFormValues } from "@/lib/validations/master-data";

export async function getProducts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("name");

  if (error) throw new Error("Ürünler getirilirken bir hata oluştu: " + error.message);
  return data;
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
