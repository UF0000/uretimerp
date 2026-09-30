"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { productionEntrySchema, ProductionEntryFormValues, productionEntryV2Schema, entryRange, type ProductionEntryV2Values } from "@/lib/validations/production";
import { one } from "@/lib/utils";
import { firstPositive, type EntryTech } from "@/lib/entry-metrics";

const revalidateProduction = () => {
  revalidatePath("/uretim/is-emirleri");
  revalidatePath("/depo");
  revalidatePath("/depo/hareketler");
  revalidatePath("/maliyet");
  revalidatePath("/dashboard");
  revalidatePath("/uretim/analiz");
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

/** Kapatılmış iş emrini yeniden açar (yalnızca yönetici); girişler düzeltilebilir, sonra tekrar kapatılır. */
export async function reopenWorkOrder(workOrderId: string, note?: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_work_order", { p_work_order_id: workOrderId, p_note: note || undefined });
  if (error) throw new Error(error.message);
  revalidateProduction();
}

/** İş emri iptali (yalnız yönetici, neden zorunlu; geçerli girişi olan iş emri iptal edilemez) */
export async function cancelWorkOrder(workOrderId: string, note: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_work_order", { p_work_order_id: workOrderId, p_note: note });
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

// ─────────────────────────────── Üretim girişi v2 ───────────────────────────────

const num = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));

/**
 * Giriş penceresi verisi: iş emri, teknik değerler (hesaplar için), operatörler ve
 * iptal edilmemiş girişler (fire/duruş satırlarıyla, başlangıca göre sıralı).
 */
export async function getWorkOrderEntries(workOrderId: string) {
  const supabase = await createClient();
  const [woRes, entriesRes, operatorsRes, paramsRes] = await Promise.all([
    supabase
      .from("work_orders")
      .select(
        "id, no, status, planned_qty, line_id, mold_id, product:products(code, name, unit), bom:boms(production_type, bom_extrusion(line_id, kg_per_meter, target_m_per_hour), bom_injection(mold_id, cavity_count, cycle_time_sec, product_weight_g, runner_sprue_weight_g))",
      )
      .eq("id", workOrderId)
      .single(),
    supabase
      .from("production_entries")
      .select(
        "id, start_at, end_at, entry_time, shift, operator, operator_id, produced_qty, total_used_kg, scrap_qty, downtime_min, lot_no, actual_cycle_time_sec, scraps:production_entry_scraps(reason_code_id, kg), downtimes:production_entry_downtimes(reason_code_id, minutes)",
      )
      .eq("work_order_id", workOrderId)
      .is("cancelled_at", null)
      .order("entry_time"),
    supabase.from("operators").select("id, name").eq("active", true).order("name"),
    supabase.from("cost_parameters").select("shift_minutes, target_scrap_pct, overweight_tolerance_pct, target_oee_pct").limit(1).maybeSingle(),
  ]);
  if (woRes.error) throw new Error("İş emri getirilirken hata oluştu: " + woRes.error.message);
  if (entriesRes.error) throw new Error("Girişler getirilirken hata oluştu: " + entriesRes.error.message);

  const wo = woRes.data;
  const bom = one(wo.bom);
  const ext = one(bom?.bom_extrusion ?? null);
  const inj = one(bom?.bom_injection ?? null);
  const moldId = wo.mold_id ?? inj?.mold_id ?? null;
  const lineId = wo.line_id ?? ext?.line_id ?? null;

  const [moldRes, capRes] = await Promise.all([
    moldId
      ? supabase.from("molds").select("code, name, cavity_count, cycle_time_sec, product_weight_g, sprue_weight_g").eq("id", moldId).maybeSingle()
      : Promise.resolve({ data: null }),
    lineId
      ? supabase.from("line_capacities").select("capacity_kg_per_hour, valid_from, valid_to").eq("line_id", lineId).eq("active", true)
      : Promise.resolve({ data: [] }),
  ]);
  const mold = moldRes.data;
  const capacities = (capRes.data ?? []) as { capacity_kg_per_hour: number; valid_from: string; valid_to: string | null }[];
  const capacityOn = (day: string) => {
    const c = capacities
      .filter((x) => x.valid_from <= day && (!x.valid_to || x.valid_to >= day))
      .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
    return c ? Number(c.capacity_kg_per_hour) : null;
  };
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
  const shiftMinutes = Number(paramsRes.data?.shift_minutes ?? 720);

  const tech: EntryTech = {
    productionType: bom?.production_type ?? "extrusion",
    kgPerMeter: num(ext?.kg_per_meter),
    targetMPerHour: num(ext?.target_m_per_hour),
    // Reçetede 0/boş alan kalıp kartına düşer (reçete formu yolluğu varsayılan 0 kaydeder)
    cycleTimeSec: firstPositive(num(inj?.cycle_time_sec), num(mold?.cycle_time_sec)),
    cavityCount: firstPositive(num(inj?.cavity_count), num(mold?.cavity_count)),
    productWeightG: firstPositive(num(inj?.product_weight_g), num(mold?.product_weight_g)),
    runnerWeightG: firstPositive(num(inj?.runner_sprue_weight_g), num(mold?.sprue_weight_g)),
    capacityKgPerHour: capacityOn(today),
  };

  const entries = (entriesRes.data ?? []).map((e) => {
    const day = new Date(e.start_at ?? e.entry_time ?? Date.now()).toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
    const plannedMin = e.start_at && e.end_at ? (Date.parse(e.end_at) - Date.parse(e.start_at)) / 60000 : shiftMinutes;
    return {
      id: e.id,
      startAt: e.start_at,
      endAt: e.end_at,
      entryTime: e.entry_time,
      shift: e.shift,
      operator: e.operator,
      operatorId: e.operator_id,
      producedQty: Number(e.produced_qty),
      usedKg: Number(e.total_used_kg),
      scrapKg: Number(e.scrap_qty),
      downtimeMin: Number(e.downtime_min),
      plannedMin,
      lotNo: e.lot_no,
      scraps: (e.scraps ?? []).map((x) => ({ reasonCodeId: x.reason_code_id, kg: Number(x.kg) })),
      downtimes: (e.downtimes ?? []).map((x) => ({ reasonCodeId: x.reason_code_id, minutes: Number(x.minutes) })),
      capacityKgPerHour: capacityOn(day),
    };
  });

  return {
    workOrder: {
      id: wo.id,
      no: wo.no,
      status: wo.status,
      plannedQty: Number(wo.planned_qty),
      product: one(wo.product),
      moldLabel: mold ? `${mold.code} ${mold.name}` : null,
    },
    tech,
    operators: operatorsRes.data ?? [],
    entries,
    targets: {
      scrapPct: Number(paramsRes.data?.target_scrap_pct ?? 3),
      overweightTolerancePct: Number(paramsRes.data?.overweight_tolerance_pct ?? 2.5),
      oeePct: Number(paramsRes.data?.target_oee_pct ?? 85),
    },
  };
}

export type WorkOrderEntries = Awaited<ReturnType<typeof getWorkOrderEntries>>;

/** Yeni giriş ya da düzeltme (replaces_entry_id): tek işlemde eski giriş iptal + yeni giriş. */
export async function saveProductionEntry(values: ProductionEntryV2Values) {
  const parsed = productionEntryV2Schema.safeParse(values);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz üretim verisi.");
  const v = parsed.data;
  const { startAt, endAt } = entryRange(v.date, v.start_time, v.end_time);
  const selectedLots = Object.entries(v.raw_lots ?? {}).filter(([, lot]) => lot.trim() !== "");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_production_entry", {
    p: {
      work_order_id: v.work_order_id,
      replaces_entry_id: v.replaces_entry_id || null,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      operator_id: v.operator_id,
      produced_qty: v.produced_qty,
      total_used_kg: v.total_used_kg,
      scraps: v.scraps.map((x) => ({ reason_code_id: x.reason_code_id, kg: x.kg })),
      downtimes: v.downtimes.map((x) => ({ reason_code_id: x.reason_code_id, minutes: x.minutes })),
      scrap_product_id: v.scraps.length ? v.scrap_product_id || null : null,
      target_warehouse_id: v.produced_qty > 0 ? v.target_warehouse_id || null : null,
      close_work_order: v.close_work_order,
      raw_lots: selectedLots.length ? Object.fromEntries(selectedLots) : {},
    },
  });
  if (error) throw new Error(error.message);
  revalidateProduction();
  const r = data as { lot_no: string | null; mold_shots: number; closed: boolean; replaced: boolean };
  return { lotNo: r.lot_no, moldShots: r.mold_shots, closed: r.closed, replaced: r.replaced };
}

/** Girişi iptal eder: stok hareketleri ters kayıtla geri alınır, kalıp sayacı düşülür. */
export async function cancelProductionEntry(entryId: string, note?: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_production_entry", { p_entry_id: entryId, p_note: note || undefined });
  if (error) throw new Error(error.message);
  revalidateProduction();
}
