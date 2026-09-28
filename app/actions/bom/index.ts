"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { bomSchema, BomFormValues } from "@/lib/validations/bom";
import { one } from "@/lib/utils";

export async function getBoms() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boms")
    .select(`
      *,
      product:products(name, code),
      extrusion:bom_extrusion(*),
      injection:bom_injection(*),
      items:bom_items(*, product:products(name, code))
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Reçeteler getirilirken hata oluştu: " + error.message);
  return data;
}

export async function getBomById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boms")
    .select(`
      *,
      extrusion:bom_extrusion(*),
      injection:bom_injection(*),
      items:bom_items(*),
      parameters:bom_parameters(*)
    `)
    .eq("id", id)
    .single();

  if (error) throw new Error("Reçete detayı getirilirken hata oluştu: " + error.message);
  
  // Reçete detayları bire bir ilişki: veritabanı tek nesne döndürür
  const formattedData = {
    ...data,
    extrusion: one(data.extrusion),
    injection: one(data.injection),
  };
  
  return formattedData;
}

/**
 * Reçeteyi tek veritabanı işleminde kaydeder (save_bom).
 * Üretimde kullanılmış bir reçete düzenlenirse yerinde değiştirilmez:
 * yeni versiyon açılır, eskisi pasife alınır — geçmiş maliyetler bozulmaz.
 */
export async function saveBom(data: BomFormValues) {
  const supabase = await createClient();
  const parsed = bomSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz form verisi.");
  const payload = parsed.data;

  const { data: result, error } = await supabase.rpc("save_bom", {
    p_bom: {
      id: payload.id ?? null,
      product_id: payload.product_id,
      code: payload.id ? null : payload.code || null,
      name: payload.name,
      active: payload.active,
      production_type: payload.production_type,
      regrind_pct: payload.regrind_pct ?? null,
      notes: payload.notes ?? null,
      items: payload.items.map((item) => ({
        component_product_id: item.component_product_id,
        quantity: item.quantity,
        unit: item.unit,
        ratio_pct: item.ratio_pct ?? null,
      })),
      parameters: (payload.parameters ?? []).map((p) => ({ key: p.key, value: p.value })),
      extrusion: payload.production_type === "extrusion" ? payload.extrusion ?? null : null,
      injection: payload.production_type === "injection" ? payload.injection ?? null : null,
    },
  });
  if (error) throw new Error(error.message);

  revalidatePath("/recete");
  const r = result as { id: string; code: string; version: number; new_version: boolean };
  return { id: r.id, code: r.code, version: r.version, newVersion: r.new_version };
}

export async function deleteBom(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("boms")
    .update({ active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/recete");
}

export async function restoreBom(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("boms")
    .update({ active: true })
    .eq("id", id);
  if (error) throw new Error("Geri yükleme başarısız: " + error.message);
  revalidatePath("/recete");
}

/** Kullanılmamış reçeteyi detaylarıyla birlikte kalıcı siler (delete_bom). */
export async function hardDeleteBom(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_bom", { p_id: id });
  if (error) throw new Error("Kalıcı silme başarısız: " + error.message);
  revalidatePath("/recete");
}

export async function bulkDeleteBoms(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("boms")
    .update({ active: false })
    .in("id", ids);
  if (error) throw new Error("Toplu işlem başarısız: " + error.message);
  revalidatePath("/recete");
}

export async function hardBulkDeleteBoms(ids: string[]) {
  const supabase = await createClient();
  for (const id of ids) {
    const { error } = await supabase.rpc("delete_bom", { p_id: id });
    if (error) throw new Error("Toplu kalıcı silme başarısız: " + error.message);
  }
  revalidatePath("/recete");
}

export type BomRow = Awaited<ReturnType<typeof getBoms>>[number];
