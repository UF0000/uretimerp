"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { qualityCheckSchema, QualityCheckFormValues } from "@/lib/validations/quality";

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
      product:products(name, code)
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export type QualityCheckRow = Awaited<ReturnType<typeof getQualityChecks>>[number];
