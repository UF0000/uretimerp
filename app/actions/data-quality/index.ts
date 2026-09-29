"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { findDataIssues, type DqBom } from "@/lib/data-quality";

/** PostgREST 1.000 satır sınırına takılmadan tüm sayfaları okur. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error("Eksik veri kontrolü yapılamadı: " + error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const num = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));

export async function getDataIssues() {
  await requirePermission("master-data:read");
  const supabase = await createClient();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });

  const [boms, molds, lines, capacities, references, warehouses, params] = await Promise.all([
    readAll((f, t) =>
      supabase
        .from("boms")
        .select(
          "id, code, production_type, product:products(id, code, name, active, material_group, diameter_mm, sdr), bom_extrusion(line_id, kg_per_meter, target_m_per_hour), bom_injection(mold_id, cavity_count, cycle_time_sec, product_weight_g), bom_items(component:products!component_product_id(id, code, name, type, unit_cost, currency))",
        )
        .eq("active", true)
        .order("code")
        .range(f, t),
    ),
    readAll((f, t) => supabase.from("molds").select("id, code, name, cavity_count, cycle_time_sec, product_weight_g, status").order("code").range(f, t)),
    supabase.from("production_lines").select("id, code, name, line_type, status").order("code"),
    supabase.from("line_capacities").select("line_id, valid_from, valid_to").eq("active", true),
    supabase.from("reference_capacities").select("material_group, diameter_mm, sdr").eq("active", true).eq("approval", "approved"),
    supabase.from("warehouses").select("type"),
    supabase.from("cost_parameters").select("usd_rate, eur_rate").limit(1).maybeSingle(),
  ]);
  for (const res of [lines, capacities, references, warehouses, params]) {
    if (res.error) throw new Error("Eksik veri kontrolü yapılamadı: " + res.error.message);
  }

  const components = new Map<string, { code: string; name: string; type: string; unitCost: number | null; currency: string | null }>();
  const dqBoms: DqBom[] = [];
  for (const b of boms) {
    const product = one(b.product);
    if (!product || !product.active) continue;
    const items = b.bom_items ?? [];
    for (const it of items) {
      const c = one(it.component);
      if (c) components.set(c.id, { code: c.code, name: c.name, type: c.type, unitCost: num(c.unit_cost), currency: c.currency });
    }
    const ex = one(b.bom_extrusion);
    const inj = one(b.bom_injection);
    dqBoms.push({
      id: b.id,
      code: b.code,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      productionType: b.production_type,
      materialGroup: product.material_group,
      diameterMm: num(product.diameter_mm),
      sdr: num(product.sdr),
      itemCount: items.length,
      componentIds: items.map((it) => one(it.component)?.id).filter((id): id is string => Boolean(id)),
      extrusion: ex ? { lineId: ex.line_id, kgPerMeter: num(ex.kg_per_meter), targetMPerHour: num(ex.target_m_per_hour) } : null,
      injection: inj
        ? { moldId: inj.mold_id, cavityCount: num(inj.cavity_count), cycleTimeSec: num(inj.cycle_time_sec), productWeightG: num(inj.product_weight_g) }
        : null,
    });
  }

  const issues = findDataIssues({
    boms: dqBoms,
    molds: new Map(
      molds.map((m) => [
        m.id,
        { code: m.code, name: m.name, active: m.status === "active", cavityCount: m.cavity_count, cycleTimeSec: Number(m.cycle_time_sec), productWeightG: num(m.product_weight_g) },
      ]),
    ),
    lines: (lines.data ?? [])
      .filter((l) => l.status !== "down")
      .map((l) => ({
        id: l.id,
        code: l.code,
        name: l.name,
        lineType: l.line_type,
        hasCurrentCapacity: (capacities.data ?? []).some((c) => c.line_id === l.id && c.valid_from <= today && (!c.valid_to || c.valid_to >= today)),
      })),
    components,
    references: (references.data ?? []).map((r) => ({ materialGroup: r.material_group, diameterMm: Number(r.diameter_mm), sdr: num(r.sdr) })),
    warehouseTypes: new Set((warehouses.data ?? []).map((w) => w.type)),
    rates: { usd: Number(params.data?.usd_rate ?? 1), eur: Number(params.data?.eur_rate ?? 1) },
  });

  return { issues, checkedBoms: dqBoms.length, checkedMolds: molds.length };
}

export type DataIssuesReport = Awaited<ReturnType<typeof getDataIssues>>;
