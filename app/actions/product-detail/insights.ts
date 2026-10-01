"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { inChunks, readAll } from "@/lib/supabase/read-all";
import { one } from "@/lib/utils";
import { measure, reasonParts, soundKg, type AnalyticsEntry } from "@/lib/production-analytics";
import { loadReasonParts } from "@/lib/supabase/entry-reasons";
import { getCompletedWorkOrdersForCosting } from "@/app/actions/cost";

const DAY = 86400000;
const OPEN_ORDER = ["open", "in_production"] as const;
const OPEN_WO = ["planned", "in_progress"] as const;
/** Satılamayan stok: karantina, hurda, regrind depoları kullanılabilir stoğa girmez */
const UNUSABLE_WAREHOUSES = new Set(["quarantine", "scrap", "regrind"]);

/**
 * Ürün kartı alt bölümleri: stok/rezervasyon/tükenme, üretim performansı,
 * kalite geçmişi ve gerçekleşen maliyet.
 *
 * Kullanılabilir stok = kullanılabilir depolardaki stok − açık siparişlerin teslim edilmemiş miktarı
 * Tahmini tükenme   = kullanılabilir stok / son 90 günün günlük ortalama çıkışı
 *                     (mamul: satış · hammadde: üretimde tüketim)
 */
export async function getProductInsights(productId: string) {
  await requirePermission("master-data:read");
  const supabase = await createClient();
  const now = Date.now();
  const since90 = new Date(now - 90 * DAY).toISOString();
  const since365 = new Date(now - 365 * DAY).toISOString().slice(0, 10);

  const [productRes, whRes, stockRes, lotRes, orderRes, woRes, qcRes, ncrRes, paramsRes, reasonsRes, outMoves] = await Promise.all([
    supabase.from("products").select("type, unit").eq("id", productId).single(),
    supabase.from("warehouses").select("id, name, type"),
    supabase.from("v_stock").select("warehouse_id, qty").eq("product_id", productId),
    supabase.from("v_stock_lot").select("warehouse_id, lot_no, qty, first_in_at").eq("product_id", productId).gt("qty", 0).order("first_in_at"),
    supabase
      .from("order_items")
      .select("quantity, delivered_qty, order:orders!inner(id, no, status, delivery_date, order_date, partner:partners(name))")
      .eq("product_id", productId)
      .in("order.status", [...OPEN_ORDER]),
    supabase.from("work_orders").select("id, no, status, planned_qty, started_at, production:production_entries(produced_qty, cancelled_at)").eq("product_id", productId).in("status", [...OPEN_WO]).order("no"),
    supabase.from("quality_checks").select("id, type, lot_no, standard, result, checked_at").eq("product_id", productId).order("checked_at", { ascending: false }).limit(50),
    supabase.from("ncr").select("id, no, status, description, quantity, lot_no, created_at, closed_at").eq("product_id", productId).order("created_at", { ascending: false }).limit(20),
    supabase.from("cost_parameters").select("target_scrap_pct, overweight_tolerance_pct, target_oee_pct").limit(1).maybeSingle(),
    supabase.from("reason_codes").select("id, label"),
    readAll(
      (f, t) =>
        supabase
          .from("stock_movements")
          .select("id, direction, source_type, quantity, reverses_id")
          .eq("product_id", productId)
          .gte("created_at", since90)
          .order("created_at")
          .range(f, t),
      "Stok hareketleri getirilirken hata oluştu",
    ),
  ]);
  if (productRes.error) throw new Error("Ürün getirilirken hata oluştu: " + productRes.error.message);
  const isMaterial = productRes.data.type === "raw";
  const whById = new Map((whRes.data ?? []).map((w) => [w.id, w]));

  // ── Stok: depo ve lot kırılımı ──
  const byWarehouse = (stockRes.data ?? [])
    .filter((s) => Number(s.qty) !== 0)
    .map((s) => {
      const w = whById.get(s.warehouse_id!);
      return { warehouseId: s.warehouse_id!, name: w?.name ?? "?", type: w?.type ?? "", qty: Number(s.qty), usable: !UNUSABLE_WAREHOUSES.has(w?.type ?? "") };
    })
    .sort((a, b) => b.qty - a.qty);
  const physical = byWarehouse.reduce((s, w) => s + w.qty, 0);
  const usableStock = byWarehouse.filter((w) => w.usable).reduce((s, w) => s + w.qty, 0);
  const lots = (lotRes.data ?? []).map((l) => ({
    lotNo: l.lot_no ?? "—",
    warehouse: whById.get(l.warehouse_id!)?.name ?? "?",
    qty: Number(l.qty),
    ageDays: l.first_in_at ? Math.floor((now - Date.parse(l.first_in_at)) / DAY) : null,
  }));

  // ── Rezervasyon: açık siparişler ve iş emirleri ──
  const openOrders = (orderRes.data ?? [])
    .map((it) => {
      const o = one(it.order);
      return {
        orderId: o?.id ?? "",
        no: o?.no ?? "",
        customer: one(o?.partner ?? null)?.name ?? "—",
        status: o?.status ?? "open",
        deliveryDate: o?.delivery_date ?? null,
        ordered: Number(it.quantity),
        remaining: Math.max(0, Number(it.quantity) - Number(it.delivered_qty ?? 0)),
      };
    })
    .filter((o) => o.remaining > 0)
    .sort((a, b) => (a.deliveryDate ?? "9999").localeCompare(b.deliveryDate ?? "9999"));
  const reserved = openOrders.reduce((s, o) => s + o.remaining, 0);
  const openWorkOrders = (woRes.data ?? []).map((w) => {
    const produced = (w.production ?? []).filter((e) => !e.cancelled_at).reduce((s, e) => s + Number(e.produced_qty || 0), 0);
    return { id: w.id, no: w.no, status: w.status, planned: Number(w.planned_qty), produced, remaining: Math.max(0, Number(w.planned_qty) - produced) };
  });
  const inProduction = openWorkOrders.reduce((s, w) => s + w.remaining, 0);
  const available = usableStock - reserved;

  // ── Tahmini tükenme (son 90 günün ortalama çıkışı) ──
  const reversed = new Set(outMoves.map((m) => m.reverses_id).filter(Boolean));
  const outKind = isMaterial ? "production" : "sale";
  const out90 = outMoves
    .filter((m) => !m.reverses_id && !reversed.has(m.id) && m.direction === "out" && m.source_type === outKind)
    .reduce((s, m) => s + Number(m.quantity), 0);
  const dailyOut = out90 / 90;
  const daysLeft = dailyOut > 0 ? Math.max(0, available) / dailyOut : null;
  const depletionDate = daysLeft !== null ? new Date(now + daysLeft * DAY).toISOString().slice(0, 10) : null;

  // ── Üretim performansı (son 12 ay, analiz panosuyla aynı hesap) ──
  const perfRows = await readAll(
    (f, t) =>
      supabase
        .from("v_production_analytics")
        .select("entry_id, day, shift, work_order_id, work_order_no, product_unit, line_id, operator, used_kg, scrap_kg, good_kg, produced_qty, nominal_kg, runner_kg, planned_min, run_min, downtime_min, scrap_reason_code_id, downtime_reason_code_id, capacity_kg_per_hour, reference_kg_per_hour")
        .eq("product_id", productId)
        .gte("day", since365)
        .order("entry_time")
        .range(f, t),
    "Üretim verileri getirilirken hata oluştu",
  );
  const ideal = await inChunks(
    perfRows.map((r) => r.entry_id!),
    150,
    (c) => supabase.from("v_oee_entries").select("entry_id, ideal_sec").in("entry_id", c),
  );
  const idealBy = new Map(ideal.map((i) => [i.entry_id, i.ideal_sec === null ? null : Number(i.ideal_sec)]));
  const parts = await loadReasonParts(supabase, perfRows.map((r) => r.entry_id!));
  const entries: AnalyticsEntry[] = perfRows.map((r) => ({
    entryId: r.entry_id!,
    day: r.day!,
    shift: r.shift!,
    workOrderId: r.work_order_id!,
    workOrderNo: r.work_order_no!,
    productId,
    productCode: "",
    productName: "",
    productUnit: r.product_unit!,
    bomCode: "",
    lineId: r.line_id,
    operator: r.operator,
    usedKg: Number(r.used_kg ?? 0),
    scrapKg: Number(r.scrap_kg ?? 0),
    ...soundKg(r),
    producedQty: Number(r.produced_qty ?? 0),
    nominalKg: r.nominal_kg === null ? null : Number(r.nominal_kg),
    plannedMin: Number(r.planned_min ?? 0),
    runMin: Number(r.run_min ?? 0),
    downtimeMin: Number(r.downtime_min ?? 0),
    scrapReasonId: r.scrap_reason_code_id,
    downtimeReasonId: r.downtime_reason_code_id,
    capacityKgPerHour: r.capacity_kg_per_hour === null ? null : Number(r.capacity_kg_per_hour),
    referenceKgPerHour: r.reference_kg_per_hour === null ? null : Number(r.reference_kg_per_hour),
    idealSec: idealBy.get(r.entry_id!) ?? null,
    scrapParts: parts.scrap.get(r.entry_id!),
    downtimeParts: parts.downtime.get(r.entry_id!),
    runnerKg: r.runner_kg === null ? null : Number(r.runner_kg),
  }));
  const reasonLabel = new Map((reasonsRes.data ?? []).map((r) => [r.id, r.label]));
  const topReasons = (kind: "scrap" | "downtime") => {
    const m = new Map<string, number>();
    for (const e of entries) for (const p of reasonParts(e, kind)) m.set(p.reasonId, (m.get(p.reasonId) ?? 0) + p.value);
    const total = [...m.values()].reduce((s, v) => s + v, 0);
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, v]) => ({ label: reasonLabel.get(id) ?? "Bilinmeyen", value: v, share: total > 0 ? v / total : 0 }));
  };
  const performance = entries.length
    ? {
        ...measure(entries),
        workOrders: new Set(entries.map((e) => e.workOrderId)).size,
        topScrap: topReasons("scrap"),
        topDowntime: topReasons("downtime"),
      }
    : null;

  // ── Kalite ──
  const checks = qcRes.data ?? [];
  const quality = {
    checks: checks.map((c) => ({ id: c.id, type: c.type, lotNo: c.lot_no, standard: c.standard, result: c.result, checkedAt: c.checked_at })),
    counts: {
      accept: checks.filter((c) => c.result === "accept").length,
      conditional: checks.filter((c) => c.result === "conditional").length,
      reject: checks.filter((c) => c.result === "reject").length,
    },
    ncrs: (ncrRes.data ?? []).map((n) => ({ id: n.id, no: n.no, status: n.status, description: n.description, quantity: Number(n.quantity), lotNo: n.lot_no, createdAt: n.created_at })),
  };

  // ── Gerçekleşen maliyet (biten iş emirleri) ──
  const actual = (await getCompletedWorkOrdersForCosting(productId))
    .filter((r) => r.metrics.produced > 0)
    .map((r) => ({ id: r.id, no: r.no, finishedAt: r.finished_at, produced: r.metrics.produced, unitCost: r.metrics.unitCostFinal, totalCost: r.metrics.totalCost, bomLabel: r.bomLabel }))
    .sort((a, b) => (a.finishedAt ?? "").localeCompare(b.finishedAt ?? ""));
  const actualProduced = actual.reduce((s, r) => s + r.produced, 0);
  const actualAvg = actualProduced > 0 ? actual.reduce((s, r) => s + r.totalCost, 0) / actualProduced : null;

  const p = paramsRes.data;
  return {
    isMaterial,
    stock: { physical, usableStock, reserved, available, inProduction, projected: available + inProduction, byWarehouse, lots, openOrders, openWorkOrders },
    depletion: { outKind, dailyOut, daysLeft, depletionDate },
    performance,
    targets: { scrapPct: Number(p?.target_scrap_pct ?? 3), overweightTolerancePct: Number(p?.overweight_tolerance_pct ?? 2.5), oeePct: Number(p?.target_oee_pct ?? 85) },
    quality,
    actualCost: { rows: actual, average: actualAvg },
  };
}

export type ProductInsights = Awaited<ReturnType<typeof getProductInsights>>;
