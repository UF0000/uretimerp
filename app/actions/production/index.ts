"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { productionEntrySchema, ProductionEntryFormValues } from "@/lib/validations/production";

const revalidateProduction = () => {
  revalidatePath("/uretim/is-emirleri");
  revalidatePath("/depo");
  revalidatePath("/depo/hareketler");
  revalidatePath("/maliyet");
  revalidatePath("/dashboard");
};

/**
 * Tek vardiyalık üretim girişi (record_production_entry). Üretim kaydı, lot,
 * hammadde tüketimi, mamul/fire girişi, kalıp atışı ve istenirse iş emri
 * kapanışı tek veritabanı işleminde yapılır; bir adım başarısızsa hiçbiri yazılmaz.
 */
export async function recordProductionEntry(data: ProductionEntryFormValues) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Oturum bulunamadı.");

  const parsed = productionEntrySchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz üretim verisi.");
  const p = parsed.data;

  const { data: result, error } = await supabase.rpc("record_production_entry", {
    p_work_order_id: p.work_order_id,
    p_shift: p.shift,
    p_produced_qty: p.produced_qty,
    p_total_used_kg: p.total_used_kg,
    p_scrap_kg: p.scrap_kg,
    p_scrap_product_id: p.scrap_product_id || undefined,
    p_scrap_reason_code_id: p.scrap_reason_code_id || undefined,
    p_downtime_min: p.downtime_min,
    p_downtime_reason_code_id: p.downtime_reason_code_id || undefined,
    p_actual_cycle_time_sec: p.actual_cycle_time_sec ?? undefined,
    p_target_warehouse_id: p.target_warehouse_id || undefined,
    p_operator: p.operator || undefined,
    p_close_work_order: p.close_work_order,
  });
  if (error) throw new Error(error.message);

  revalidateProduction();
  const r = result as { lot_no: string | null; mold_shots: number; closed: boolean };
  return { lotNo: r.lot_no, moldShots: r.mold_shots, closed: r.closed };
}

/** Son vardiya girildikten sonra iş emrini kapatır (en az bir üretim girişi şart). */
export async function closeWorkOrder(workOrderId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_work_order", { p_work_order_id: workOrderId });
  if (error) throw new Error(error.message);
  revalidateProduction();
}
