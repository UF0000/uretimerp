"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { reasonCodeSchema, ReasonCodeFormValues } from "@/lib/validations/master-data";

export async function getReasonCodes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reason_codes")
    .select("*")
    .order("code");

  if (error) throw new Error("Neden kodları getirilirken hata oluştu: " + error.message);
  return data;
}

export async function saveReasonCode(data: ReasonCodeFormValues) {
  const supabase = await createClient();
  const parsed = reasonCodeSchema.safeParse(data);
  if (!parsed.success) throw new Error("Geçersiz form verisi.");
  
  const payload = parsed.data;

  if (payload.id) {
    const { error } = await supabase
      .from("reason_codes")
      .update({
        kind: payload.kind,
        code: payload.code,
        label: payload.label,
      })
      .eq("id", payload.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("reason_codes")
      .insert([{
        kind: payload.kind,
        code: payload.code,
        label: payload.label,
      }]);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/ana-veri");
}

export async function deleteReasonCode(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reason_codes")
    .delete()
    .eq("id", id);
  if (error) throw new Error("Bağlı kayıtlar olduğu için silinemez.");
  revalidatePath("/ana-veri");
}

export async function bulkDeleteReasonCodes(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reason_codes")
    .delete()
    .in("id", ids);
  if (error) throw new Error("Toplu silme başarısız: Bağlı kayıtlar olabilir.");
  revalidatePath("/ana-veri");
}

export type ReasonCodeRow = Awaited<ReturnType<typeof getReasonCodes>>[number];
