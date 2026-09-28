"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ExcelRow } from "@/lib/excel";
import { lineSchema, moldSchema, LineFormValues, MoldFormValues } from "@/lib/validations/master-data";

// --- Production Lines ---
export async function getLines() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("production_lines")
    .select("*")
    .order("name");

  if (error) throw new Error("Hatlar getirilirken hata oluştu: " + error.message);
  return data;
}

export async function saveLine(data: LineFormValues) {
  const supabase = await createClient();
  const parsed = lineSchema.safeParse(data);
  if (!parsed.success) throw new Error("Geçersiz form verisi.");
  
  const payload = parsed.data;

  if (payload.id) {
    const { error } = await supabase
      .from("production_lines")
      .update({
        code: payload.code,
        name: payload.name,
        head_type: payload.head_type || null,
        status: payload.status,
      })
      .eq("id", payload.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("production_lines")
      .insert([{
        code: payload.code,
        name: payload.name,
        head_type: payload.head_type || null,
        status: payload.status,
      }]);
    if (error) {
      if (error.code === '23505' || error.message.includes('unique')) {
        throw new Error("Bu hat koduna sahip başka bir kayıt zaten var. Lütfen farklı bir Hat Kodu girin.");
      }
      throw new Error(error.message);
    }
  }
  revalidatePath("/ana-veri");
}

export async function deleteLine(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("production_lines")
    .delete()
    .eq("id", id);
  if (error) throw new Error("Bağlı kayıtlar olduğu için silinemez.");
  revalidatePath("/ana-veri");
}

export async function bulkDeleteLines(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("production_lines")
    .delete()
    .in("id", ids);
  if (error) throw new Error("Toplu silme başarısız: Bağlı kayıtlar olabilir.");
  revalidatePath("/ana-veri");
}

// --- Molds ---
export async function getMolds() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("molds")
    .select(`*, product:products(name)`)
    .order("name");

  if (error) throw new Error("Kalıplar getirilirken hata oluştu: " + error.message);
  return data;
}

export async function saveMold(data: MoldFormValues) {
  const supabase = await createClient();
  const parsed = moldSchema.safeParse(data);
  if (!parsed.success) throw new Error("Geçersiz form verisi.");
  
  const payload = parsed.data;

  if (payload.id) {
    const { error } = await supabase
      .from("molds")
      .update({
        code: payload.code,
        name: payload.name,
        product_id: payload.product_id || null,
        cavity_count: payload.cavity_count,
        cycle_time_sec: payload.cycle_time_sec,
        total_shots: payload.total_shots,
        sprue_weight_g: payload.sprue_weight_g || null,
        product_weight_g: payload.product_weight_g || null,
        maintenance_plan: payload.maintenance_plan || null,
        status: payload.status,
      })
      .eq("id", payload.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("molds")
      .insert([{
        code: payload.code,
        name: payload.name,
        product_id: payload.product_id || null,
        cavity_count: payload.cavity_count,
        cycle_time_sec: payload.cycle_time_sec,
        total_shots: payload.total_shots,
        sprue_weight_g: payload.sprue_weight_g || null,
        product_weight_g: payload.product_weight_g || null,
        maintenance_plan: payload.maintenance_plan || null,
        status: payload.status,
      }]);
    if (error) {
      if (error.code === '23505' || error.message.includes('unique')) {
        throw new Error("Bu kalıp koduna sahip başka bir kayıt zaten var. Lütfen farklı bir Kalıp Kodu girin.");
      }
      throw new Error(error.message);
    }
  }
  revalidatePath("/ana-veri");
}

export async function deleteMold(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("molds")
    .delete()
    .eq("id", id);
  if (error) throw new Error("Bağlı kayıtlar olduğu için silinemez.");
  revalidatePath("/ana-veri");
}

export async function bulkDeleteMolds(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("molds")
    .delete()
    .in("id", ids);
  if (error) throw new Error("Toplu silme işlemi başarısız: " + error.message);
  revalidatePath("/ana-veri");
}

// --- Bulk Import Molds ---
export async function bulkImportMolds(moldsData: ExcelRow[]) {
  const supabase = await createClient();

  // Excel'deki verilerde STOK KODU geçiyorsa bunları toplayıp products tablosundan id'leri çekelim
  const productCodes = moldsData
    .map(p => String(p["STOK KODU"] || p.Kodu || p.STOKKODU || "").trim())
    .filter(c => c !== "");

  const productMap = new Map<string, string>();
  if (productCodes.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, code")
      .in("code", productCodes);
      
    if (products) {
      products.forEach(prod => {
        productMap.set(prod.code, prod.id);
      });
    }
  }

  const payload = moldsData.map(p => {
    const productCode = String(p["STOK KODU"] || p.Kodu || p.STOKKODU || "").trim();
    const productName = String(p["ÜRÜN ADI"] || p.Adı || p.Name || p.URUNADI || "").trim();
    
    // Ürün varsa id'sini al
    const product_id = productMap.get(productCode) || null;
    
    // Kalıp Kodu ve Adı Otomatik Oluşturma
    // Kalıp Kodu: KLP-STOK_KODU
    const code = productCode ? `KLP-${productCode}` : `KLP-NOCODE-${Math.floor(Math.random() * 10000)}`;
    const name = productName ? `Kalıp - ${productName}` : `Kalıp - ${code}`;
    
    const cavity_count = Number(p["GÖZ SAYISI"] || p.GözSayısı || p.Cavity || p.GOZSAYISI) || 1;
    
    // Çevrim süresini hesapla
    // Excel'deki "BASKI SÜRESİ" zaten toplam çevrim süresidir (Baskı başına).
    // "TEORİK ÇEVRİM SÜRESİ" ise ürün başınadır.
    const baskiSuresiStr = String(p["BASKI SÜRESİ"] || p.BaskiSuresi || p.BASKISURESİ || p.BASKISURESI || p["ÇEVRİM SÜRESİ"] || p["CEVRIM SURESI"] || "").replace(',', '.').replace(/[^0-9.]/g, '');
    const teorikCevrimStr = String(p["TEORİK ÇEVRİM SÜRESİ"] || p.TeorikCevrim || p.TEORİKCEVRİM || p.TEORIKCEVRIM || "").replace(',', '.').replace(/[^0-9.]/g, '');
    
    let cycle_time_sec = Number(baskiSuresiStr) || 0;
    
    // Eğer Baskı Süresi yoksa, Teorik Çevrim (Ürün Başına) değerini Göz Sayısı ile çarparak toplam süreyi bulalım
    if (cycle_time_sec === 0) {
      const teorikCevrim = Number(teorikCevrimStr) || 0;
      cycle_time_sec = teorikCevrim * cavity_count;
    }
    
    // Eğer ikisi de sıfırsa varsayılan 10 saniye koyalım ki DB patlamasın
    if (cycle_time_sec === 0) cycle_time_sec = 10;

    // Ağırlık verilerini çek (Excel'de KG cinsinden verildiği için 1000 ile çarpıp grama çeviriyoruz)
    const productWeightStr = String(p["PARÇA (KG)"] || p["ÜRÜN BAŞI PLASTİK AĞIRLIĞI"] || p["ÜRÜN AĞIRLIĞI"] || p.UrunAgirligi || p.URUNAGIRLIGI || "").replace(',', '.').replace(/[^0-9.]/g, '');
    const product_weight_kg = Number(productWeightStr) || null;
    const product_weight_g = product_weight_kg !== null ? product_weight_kg * 1000 : null;

    const sprueWeightStr = String(p["YOLLUK (KG)"] || p["YOLLUK AĞIRLIĞI"] || p.YollukAgirligi || p.YOLLUKAGIRLIGI || "").replace(',', '.').replace(/[^0-9.]/g, '');
    const sprue_weight_kg = Number(sprueWeightStr) || null;
    let sprue_weight_g = sprue_weight_kg !== null ? sprue_weight_kg * 1000 : null;

    // Kullanıcı yolluk ağırlığını ürün başına verdiğini belirtti, bu yüzden göz sayısıyla çarpıyoruz
    if (sprue_weight_g !== null) {
      sprue_weight_g = sprue_weight_g * cavity_count;
    }

    return {
      code,
      name,
      product_id,
      cavity_count,
      cycle_time_sec,
      total_shots: 0,
      sprue_weight_g,
      product_weight_g,
      status: "active",
      _hasProductCode: !!productCode // Satırın gerçekten dolu olup olmadığını anlamak için işaretliyoruz
    };
  }).filter(m => m._hasProductCode).map(m => {
    // Veritabanına göndermeden önce geçici işareti siliyoruz ki SQL hata vermesin
    const { _hasProductCode, ...rest } = m;
    return rest;
  });

  if (payload.length === 0) {
    throw new Error("Geçerli kalıp verisi bulunamadı. Lütfen Excel'de 'STOK KODU' sütununun dolu olduğundan emin olun.");
  }

  // Deduplicate by code
  const uniquePayloadMap = new Map();
  payload.forEach(item => {
    uniquePayloadMap.set(item.code, item);
  });
  const deduplicatedPayload = Array.from(uniquePayloadMap.values());

  const { error } = await supabase
    .from("molds")
    .upsert(deduplicatedPayload, { onConflict: "code" });

  if (error) {
    throw new Error("Kalıp içe aktarım sırasında hata: " + error.message);
  }

  revalidatePath("/ana-veri");
  return deduplicatedPayload.length;
}
