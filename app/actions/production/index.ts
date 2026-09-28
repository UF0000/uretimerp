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

  // Boş seçimleri at; hiç lot seçilmediyse parametre gönderilmez
  const selectedLots = Object.entries(p.raw_lots ?? {}).filter(([, lot]) => lot.trim() !== "");
  const rawLots = selectedLots.length ? Object.fromEntries(selectedLots) : undefined;

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
    p_raw_lots: rawLots,
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

/** Hammadde ve regrind depolarında bakiyesi olan lotlar (vardiya girişinde seçim için). */
export async function getRawLots() {
  const supabase = await createClient();
  const [{ data: lots, error }, { data: warehouses, error: whError }] = await Promise.all([
    supabase.from("v_stock_lot").select("product_id, warehouse_id, lot_no, qty, first_in_at").gt("qty", 0),
    supabase.from("warehouses").select("id").in("type", ["raw", "regrind"]),
  ]);
  if (error) throw new Error("Lot stokları getirilirken hata oluştu: " + error.message);
  if (whError) throw new Error("Depolar getirilirken hata oluştu: " + whError.message);

  const rawIds = new Set(warehouses.map((w) => w.id));
  return lots
    .filter((l) => l.warehouse_id && rawIds.has(l.warehouse_id) && l.product_id && l.lot_no)
    .map((l) => ({ productId: l.product_id!, lotNo: l.lot_no!, qty: Number(l.qty), firstInAt: l.first_in_at }))
    .sort((a, b) => (a.firstInAt ?? "").localeCompare(b.firstInAt ?? "")); // FIFO: en eski önce
}

export type RawLot = Awaited<ReturnType<typeof getRawLots>>[number];
