"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";

/** Operatör listesi (üretim girişinde seçilir) */
export async function getOperators() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("operators").select("id, name, active").order("active", { ascending: false }).order("name");
  if (error) throw new Error("Operatörler getirilirken hata oluştu: " + error.message);
  return data;
}

export async function saveOperator(name: string, id?: string) {
  await requirePermission("master-data:write");
  const n = name.trim().replace(/\s+/g, " ");
  if (!n) throw new Error("Operatör adı zorunludur.");
  if (n.length > 80) throw new Error("Ad en fazla 80 karakter olabilir.");
  const supabase = await createClient();
  const { error } = id ? await supabase.from("operators").update({ name: n }).eq("id", id) : await supabase.from("operators").insert({ name: n });
  if (error) {
    if (error.code === "23505") throw new Error("Bu isimde bir operatör zaten var.");
    throw new Error(error.message);
  }
  revalidatePath("/ana-veri");
}

/** Pasif operatör girişte seçilemez; geçmiş girişlerdeki adı korunur. */
export async function setOperatorActive(id: string, active: boolean) {
  await requirePermission("master-data:write");
  const supabase = await createClient();
  const { error } = await supabase.from("operators").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ana-veri");
}
