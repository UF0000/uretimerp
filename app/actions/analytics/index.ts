"use server";

import { createClient } from "@/lib/supabase/server";
import { materialFamily } from "@/lib/material-family";
import { inChunks, readAll } from "@/lib/supabase/read-all";
import {
  computeProductionAnalytics,
  type AnalyticsEntry,
  type EntryMaterial,
  type EntryScrapTarget,
} from "@/lib/production-analytics";

export interface AnalyticsFilters {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD (dahil)
  lineType: "extrusion" | "injection";
  lineId?: string;
  shift?: "day" | "night";
  productId?: string;
  workOrderId?: string;
  rawMaterialId?: string;
}

export async function getProductionAnalytics(filters: AnalyticsFilters) {
  const supabase = await createClient();

  // Girişler 1.000 satırı aşabilir: sayfa sayfa okunur
  const entriesPage = (from: number, to: number) => {
    let query = supabase
      .from("v_production_analytics")
      .select("*")
      .eq("production_type", filters.lineType)
      .gte("day", filters.from)
      .lte("day", filters.to)
      .order("entry_time")
      .order("entry_id")
      .range(from, to);
    if (filters.lineId) query = query.eq("line_id", filters.lineId);
    if (filters.shift) query = query.eq("shift", filters.shift);
    if (filters.productId) query = query.eq("product_id", filters.productId);
    if (filters.workOrderId) query = query.eq("work_order_id", filters.workOrderId);
    return query;
  };

  const [rows, linesRes, reasonsRes, paramsRes, hoursRes] = await Promise.all([
    readAll(entriesPage, "Analiz verileri getirilirken hata oluştu"),
    supabase.from("production_lines").select("id, code, name, line_type").eq("line_type", filters.lineType).order("code"),
    supabase.from("reason_codes").select("id, code, label"),
    supabase.from("cost_parameters").select("target_scrap_pct, overweight_tolerance_pct, target_oee_pct").limit(1).maybeSingle(),
    supabase.rpc("available_hours", { p_from: filters.from, p_to: filters.to }),
  ]);
  if (linesRes.error) throw new Error("Hatlar getirilirken hata oluştu: " + linesRes.error.message);
  if (hoursRes.error) throw new Error("Çalışma takvimi getirilirken hata oluştu: " + hoursRes.error.message);

  const entryIds = rows.map((r) => r.entry_id!).filter(Boolean);

  // İdeal süre (OEE performansı) ve stok hareketleri (tüketilen hammadde, fire hedefi)
  const [oee, movements] = await Promise.all([
    inChunks(entryIds, 150, (c) => supabase.from("v_oee_entries").select("entry_id, ideal_sec").in("entry_id", c)),
    inChunks(entryIds, 150, (c) =>
      supabase
        .from("stock_movements")
        .select("id, production_entry_id, direction, source_type, quantity, reverses_id, product:products(id, code, name, type, category)")
        .in("production_entry_id", c),
    ),
  ]);
  const idealByEntry = new Map(oee.map((o) => [o.entry_id, o.ideal_sec]));
  const reversed = new Set(movements.map((m) => m.reverses_id).filter(Boolean));
  const effective = movements.filter((m) => !m.reverses_id && !reversed.has(m.id));

  const materials: EntryMaterial[] = [];
  const scrapTargets: EntryScrapTarget[] = [];
  for (const m of effective) {
    const product = Array.isArray(m.product) ? m.product[0] : m.product;
    if (!product || !m.production_entry_id) continue;
    if (m.direction === "out" && m.source_type === "production") {
      // Hammadde ailesine göre (PP / PE / PERT / PEX...) toplanır
      const family = materialFamily(product);
      materials.push({ entryId: m.production_entry_id, productId: family, code: family, name: family, kg: Number(m.quantity) });
    } else if (m.direction === "in" && m.source_type === "scrap") {
      scrapTargets.push({ entryId: m.production_entry_id, type: product.type === "regrind" ? "regrind" : "scrap", kg: Number(m.quantity) });
    }
  }

  let entries: AnalyticsEntry[] = rows.map((r) => ({
    entryId: r.entry_id!,
    day: r.day!,
    shift: r.shift!,
    workOrderId: r.work_order_id!,
    workOrderNo: r.work_order_no!,
    productId: r.product_id!,
    productCode: r.product_code!,
    productName: r.product_name!,
    productUnit: r.product_unit!,
    bomCode: r.bom_code ?? "",
    lineId: r.line_id,
    operator: r.operator,
    usedKg: Number(r.used_kg ?? 0),
    scrapKg: Number(r.scrap_kg ?? 0),
    goodKg: Number(r.good_kg ?? 0),
    producedQty: Number(r.produced_qty ?? 0),
    nominalKg: r.nominal_kg === null ? null : Number(r.nominal_kg),
    plannedMin: Number(r.planned_min ?? 0),
    runMin: Number(r.run_min ?? 0),
    downtimeMin: Number(r.downtime_min ?? 0),
    scrapReasonId: r.scrap_reason_code_id,
    downtimeReasonId: r.downtime_reason_code_id,
    capacityKgPerHour: r.capacity_kg_per_hour === null ? null : Number(r.capacity_kg_per_hour),
    referenceKgPerHour: r.reference_kg_per_hour === null ? null : Number(r.reference_kg_per_hour),
    idealSec: idealByEntry.get(r.entry_id!) ?? null,
  }));

  // Filtre seçenekleri (hammadde filtresi uygulanmadan önceki kapsamdan)
  const options = {
    lines: linesRes.data.map((l) => ({ id: l.id, label: `${l.name} (${l.code})` })),
    products: [...new Map(entries.map((e) => [e.productId, { id: e.productId, label: `${e.productCode} — ${e.productName}` }])).values()],
    workOrders: [...new Map(entries.map((e) => [e.workOrderId, { id: e.workOrderId, label: e.workOrderNo }])).values()],
    rawMaterials: [...new Map(materials.map((m) => [m.productId, { id: m.productId, label: m.name }])).values()],
  };

  if (filters.rawMaterialId) {
    const withMaterial = new Set(materials.filter((m) => m.productId === filters.rawMaterialId).map((m) => m.entryId));
    entries = entries.filter((e) => withMaterial.has(e.entryId));
  }

  // Kapasite: seçili hat ya da türdeki tüm hatlar; her gün o gün geçerli kapasite × kullanılabilir saat
  const scopeLineIds = linesRes.data.filter((l) => !filters.lineId || l.id === filters.lineId).map((l) => l.id);
  const capacities = await inChunks(scopeLineIds, 150, (c) =>
    supabase
      .from("line_capacities")
      .select("line_id, capacity_kg_per_hour, valid_from, valid_to")
      .eq("active", true)
      .lte("valid_from", filters.to)
      .or(`valid_to.is.null,valid_to.gte.${filters.from}`)
      .in("line_id", c),
  );
  const dayHours = (hoursRes.data as unknown as { day: string; hours: number | string }[]).map((h) => ({ day: h.day, hours: Number(h.hours) }));
  const days = dayHours.length || 1;
  const availableHoursTotal = dayHours.reduce((a, h) => a + h.hours, 0);
  const linesWithCapacity = new Set<string>();
  let nsaCapacityKg = 0;
  for (const { day, hours } of dayHours) {
    for (const lineId of scopeLineIds) {
      const cap = capacities
        .filter((c) => c.line_id === lineId && c.valid_from <= day && (!c.valid_to || c.valid_to >= day))
        .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
      if (!cap) continue;
      linesWithCapacity.add(lineId);
      nsaCapacityKg += Number(cap.capacity_kg_per_hour) * hours;
    }
  }

  const analytics = computeProductionAnalytics({
    entries,
    materials,
    scrapTargets,
    reasons: new Map((reasonsRes.data ?? []).map((r) => [r.id, { code: r.code, label: r.label }])),
    capacityScope: {
      lineCount: scopeLineIds.length,
      linesWithCapacity: linesWithCapacity.size,
      availableLineHours: availableHoursTotal * scopeLineIds.length,
      nsaCapacityKg,
    },
    lineNames: new Map(linesRes.data.map((l) => [l.id, `${l.code} ${l.name}`])),
    trendBucket: days > 45 ? "week" : "day",
    targets: {
      scrapPct: Number(paramsRes.data?.target_scrap_pct ?? 3),
      overweightTolerancePct: Number(paramsRes.data?.overweight_tolerance_pct ?? 2.5),
      oeePct: Number(paramsRes.data?.target_oee_pct ?? 85),
    },
  });

  return { filters, days, options, analytics };
}

export type ProductionAnalyticsReport = Awaited<ReturnType<typeof getProductionAnalytics>>;
