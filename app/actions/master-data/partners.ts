"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { partnerSchema, PartnerFormValues } from "@/lib/validations/master-data";

export async function getPartners() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .select("*")
    .eq("active", true)
    .order("name");

  if (error) throw new Error("Cariler getirilirken bir hata oluştu: " + error.message);
  return data;
}

export async function savePartner(data: PartnerFormValues) {
  const supabase = await createClient();
  const parsed = partnerSchema.safeParse(data);
  if (!parsed.success) throw new Error("Geçersiz form verisi.");
  
  const payload = parsed.data;

  if (payload.id) {
    const { error } = await supabase
      .from("partners")
      .update({
        name: payload.name,
        type: payload.type,
        phone: payload.phone || null,
        address: payload.address || null,
      })
      .eq("id", payload.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("partners")
      .insert([{
        name: payload.name,
        type: payload.type,
        phone: payload.phone || null,
        address: payload.address || null,
      }]);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/ana-veri");
}

export async function deletePartner(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("partners")
    .update({ active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ana-veri");
}

export async function bulkDeletePartners(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("partners")
    .update({ active: false })
    .in("id", ids);
  if (error) throw new Error("Toplu silme başarısız: " + error.message);
  revalidatePath("/ana-veri");
}
