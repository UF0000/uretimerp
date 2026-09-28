"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { productionCompletionSchema, ProductionCompletionFormValues } from "@/lib/validations/production";

/**
 * Üretim sonu: üretim kaydı, lot, hammadde tüketimi, mamul/fire girişi,
 * kalıp atış sayacı ve iş emri kapanışı tek veritabanı işleminde yapılır
 * (complete_work_order). Herhangi bir adım başarısız olursa hiçbiri yazılmaz.
 * @returns Oluşturulan lot numarası ve eklenen kalıp atış sayısı
 */
export async function completeWorkOrder(data: ProductionCompletionFormValues) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Oturum bulunamadı.");

  const parsed = productionCompletionSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz üretim sonu verisi.");
  const payload = parsed.data;

  const { data: result, error } = await supabase.rpc("complete_work_order", {
    p_work_order_id: payload.work_order_id,
    p_shift: payload.shift,
    p_produced_qty: payload.produced_qty,
    p_total_used_kg: payload.total_used_kg,
    p_scrap_kg: payload.scrap_kg,
    p_scrap_product_id: payload.scrap_product_id || undefined,
    p_target_warehouse_id: payload.target_warehouse_id,
    p_operator: payload.operator || undefined,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/uretim/is-emirleri");
  revalidatePath("/depo");
  revalidatePath("/depo/hareketler");
  revalidatePath("/maliyet");

  const r = result as { lot_no: string; mold_shots: number };
  return { lotNo: r.lot_no, moldShots: r.mold_shots };
}
