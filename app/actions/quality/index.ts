"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  qualityCheckSchema,
  QualityCheckFormValues,
  ncrCreateSchema,
  NcrCreateFormValues,
  ncrCloseSchema,
  NcrCloseFormValues,
} from "@/lib/validations/quality";

export async function getQualityChecks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quality_checks")
    .select(`
      *,
      product:products(name, code),
      work_order:work_orders(no),
      checker:profiles(name)
    `)
    .order("checked_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function createQualityCheck(data: QualityCheckFormValues) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Oturum bulunamadı.");

  const parsed = qualityCheckSchema.safeParse(data);
  if (!parsed.success) throw new Error("Geçersiz kalite kontrol verisi.");
  const payload = parsed.data;

  // Sadece şemadaki alanlar yazılır; istemci başka sütun gönderemez
  const { error } = await supabase.from("quality_checks").insert([{
    type: payload.type,
    product_id: payload.product_id,
    work_order_id: payload.work_order_id || null,
    lot_no: payload.lot_no || null,
    standard: payload.standard || null,
    result: payload.result,
    measurements: payload.measurements ?? null,
    checked_by: user.id,
  }]);

  if (error) throw new Error(error.message);
  revalidatePath("/kalite");
  return true;
}

export async function bulkDeleteQualityChecks(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quality_checks")
    .delete()
    .in("id", ids);

  if (error) throw new Error("Toplu silme başarısız: " + error.message);
  revalidatePath("/kalite");
}

export async function getNCRs() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ncr")
    .select(`
      *,
      product:products(name, code, unit),
      quarantine:warehouses!ncr_quarantine_warehouse_id_fkey(name),
      source:warehouses!ncr_source_warehouse_id_fkey(name),
      creator:profiles!ncr_created_by_fkey(name),
      closer:profiles!ncr_closed_by_fkey(name)
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error("NCR kayıtları getirilirken hata oluştu: " + error.message);
  return data;
}

/** NCR açar; istenirse şüpheli miktarı aynı işlemde karantinaya transfer eder (create_ncr). */
export async function createNcr(data: NcrCreateFormValues) {
  const supabase = await createClient();
  const parsed = ncrCreateSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz NCR verisi.");
  const p = parsed.data;

  const { data: result, error } = await supabase.rpc("create_ncr", {
    p_product_id: p.product_id,
    p_description: p.description,
    p_quantity: p.quantity,
    p_lot_no: p.lot_no || undefined,
    p_quality_check_id: p.quality_check_id || undefined,
    p_source_warehouse_id: p.quarantine ? p.source_warehouse_id || undefined : undefined,
    p_quarantine_warehouse_id: p.quarantine ? p.quarantine_warehouse_id || undefined : undefined,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/kalite");
  revalidatePath("/depo");
  return result as { id: string; no: string; quarantined: boolean };
}

/** NCR kapatır; karantinadaki mal serbest bırakılır veya imha edilir (close_ncr). */
export async function closeNcr(data: NcrCloseFormValues) {
  const supabase = await createClient();
  const parsed = ncrCloseSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz kapatma verisi.");
  const p = parsed.data;

  const { error } = await supabase.rpc("close_ncr", {
    p_id: p.id,
    p_root_cause: p.root_cause,
    p_corrective_action: p.corrective_action,
    p_disposition: p.disposition || undefined,
    p_release_warehouse_id: p.release_warehouse_id || undefined,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/kalite");
  revalidatePath("/depo");
}

export type NcrRow = Awaited<ReturnType<typeof getNCRs>>[number];
export type QualityCheckRow = Awaited<ReturnType<typeof getQualityChecks>>[number];
