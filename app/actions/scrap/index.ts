"use server";

import { createClient } from "@/lib/supabase/server";
import { inChunks, readAll } from "@/lib/supabase/read-all";
import { computeScrapReport, type ScrapEntry } from "@/lib/scrap-report";

export interface ScrapFilters {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD (dahil)
  lineType?: "extrusion" | "injection";
  lineId?: string;
}

export async function getScrapReport(filters: ScrapFilters) {
  const supabase = await createClient();

  const page = (from: number, to: number) => {
    let q = supabase
      .from("v_production_analytics")
      .select("entry_id, day, shift, production_type, line_id, product_id, product_code, product_name, work_order_no, operator, used_kg, scrap_kg, scrap_reason_code_id")
      .gte("day", filters.from)
      .lte("day", filters.to)
      .order("entry_time")
      .order("entry_id")
      .range(from, to);
    if (filters.lineType) q = q.eq("production_type", filters.lineType);
    if (filters.lineId) q = q.eq("line_id", filters.lineId);
    return q;
  };

  const [rows, linesRes, reasonsRes, paramsRes] = await Promise.all([
    readAll(page, "Fire verileri getirilirken hata oluştu"),
    supabase.from("production_lines").select("id, code, name, line_type").order("code"),
    supabase.from("reason_codes").select("id, code, label"),
    supabase.from("cost_parameters").select("target_scrap_pct").limit(1).maybeSingle(),
  ]);
  if (linesRes.error) throw new Error("Hatlar getirilirken hata oluştu: " + linesRes.error.message);

  const entries: ScrapEntry[] = rows.map((r) => ({
    entryId: r.entry_id!,
    day: r.day!,
    shift: r.shift!,
    productionType: r.production_type!,
    lineId: r.line_id,
    productId: r.product_id!,
    productCode: r.product_code!,
    productName: r.product_name!,
    workOrderNo: r.work_order_no!,
    operator: r.operator,
    usedKg: Number(r.used_kg ?? 0),
    scrapKg: Number(r.scrap_kg ?? 0),
    scrapReasonId: r.scrap_reason_code_id,
  }));

  // Fire'nin regrind'e ayrılan kısmı (iptal edilen hareketler hariç)
  const withScrap = entries.filter((e) => e.scrapKg > 0).map((e) => e.entryId);
  const movements = await inChunks(withScrap, 150, (c) =>
    supabase
      .from("stock_movements")
      .select("id, production_entry_id, quantity, reverses_id, product:products(type)")
      .eq("source_type", "scrap")
      .eq("direction", "in")
      .in("production_entry_id", c),
  );
  const reversed = new Set(
    (
      await inChunks(
        movements.map((m) => m.id),
        150,
        (c) => supabase.from("stock_movements").select("reverses_id").in("reverses_id", c),
      )
    ).map((m) => m.reverses_id),
  );
  const regrindByEntry = new Map<string, number>();
  for (const m of movements) {
    const product = Array.isArray(m.product) ? m.product[0] : m.product;
    if (!m.production_entry_id || m.reverses_id || reversed.has(m.id) || product?.type !== "regrind") continue;
    regrindByEntry.set(m.production_entry_id, (regrindByEntry.get(m.production_entry_id) ?? 0) + Number(m.quantity));
  }

  const days = Math.round((Date.parse(filters.to) - Date.parse(filters.from)) / 86400000) + 1;
  const report = computeScrapReport(
    {
      entries,
      regrindByEntry,
      reasons: new Map((reasonsRes.data ?? []).map((r) => [r.id, { code: r.code, label: r.label }])),
      lines: new Map(linesRes.data.map((l) => [l.id, `${l.code} ${l.name}`])),
      targetScrapPct: Number(paramsRes.data?.target_scrap_pct ?? 3),
    },
    { bucket: days > 45 ? "week" : "day" },
  );

  const lineOptions = linesRes.data
    .filter((l) => !filters.lineType || l.line_type === filters.lineType)
    .map((l) => ({ id: l.id, label: `${l.code} — ${l.name}` }));

  return { filters, days, report, lineOptions };
}

/** Panel için kısa özet: bu ayın fire oranı ve en büyük neden. */
export async function getScrapSummary() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  const { report } = await getScrapReport({ from: `${today.slice(0, 8)}01`, to: today });
  return {
    scrapKg: report.total.scrapKg,
    scrapPct: report.total.scrapPct,
    targetScrapPct: report.targetScrapPct,
    topReason: report.pareto[0] ?? null,
    lostKg: report.total.lostKg,
  };
}
