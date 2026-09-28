"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { workOrderSchema, WorkOrderFormValues } from "@/lib/validations/work-orders";

export async function getWorkOrders() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_orders")
    .select(`
      *,
      product:products(name, code, unit),
      bom:boms(
        code,
        name,
        version,
        production_type,
        items:bom_items(component_product_id, ratio_pct, product:products(code, name)),
        bom_injection(runner_sprue_weight_g, cavity_count, cycle_time_sec, scrap_product_id),
        bom_extrusion(scrap_product_id)
      ),
      line:production_lines(name),
      mold:molds(name),
      order:orders(no),
      entries:production_entries(produced_qty, scrap_qty, downtime_min)
    `)
    .order("started_at", { ascending: false, nullsFirst: true })
    .order("id", { ascending: false });

  if (error) throw new Error("İş emirleri getirilirken hata oluştu: " + error.message);
  return data;
}

export type WorkOrderRow = Awaited<ReturnType<typeof getWorkOrders>>[number];

export async function saveWorkOrder(data: WorkOrderFormValues) {
  const supabase = await createClient();
  const parsed = workOrderSchema.safeParse(data);
  if (!parsed.success) throw new Error("Geçersiz iş emri verisi.");
  const payload = parsed.data;

  const { error } = await supabase
    .from("work_orders")
    .insert([{
      no: payload.no,
      product_id: payload.product_id,
      bom_id: payload.bom_id,
      planned_qty: payload.planned_qty,
      line_id: payload.line_id || null,
      mold_id: payload.mold_id || null,
      status: payload.status,
      order_id: payload.order_id || null,
    }]);

  if (error) throw new Error("İş emri kaydedilemedi: " + error.message);

  revalidatePath("/uretim/is-emirleri");
  return true;
}

/**
 * İş emrini başlatır (planned → in_progress). Kapatma yalnızca üretim girişiyle
 * (completeWorkOrder) yapılır; üretimsiz "tamamlandı" durumu oluşamaz.
 */
export async function startWorkOrder(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("work_orders")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "planned")
    .select("id");

  if (error) throw new Error(error.message);
  if (!data.length) throw new Error("Sadece planlanmış bir iş emri başlatılabilir (ya da yetkiniz yok).");
  revalidatePath("/uretim/is-emirleri");
}

export async function bulkDeleteWorkOrders(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("work_orders")
    .delete()
    .in("id", ids);

  if (error) throw new Error("İş emirleri silinirken hata oluştu: " + error.message);
  revalidatePath("/uretim/is-emirleri");
}
