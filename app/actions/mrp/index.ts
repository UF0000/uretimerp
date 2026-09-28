"use server";

import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/utils";
import { bomKgPerUnit, computeMrp, type MrpBom, type MrpProduct } from "@/lib/mrp";

/** Stok ihtiyacına sayılmayan depo tipleri */
const EXCLUDED_WAREHOUSE_TYPES = new Set(["scrap", "quarantine"]);

const sumInto = (map: Map<string, number>, key: string, value: number) =>
  map.set(key, (map.get(key) ?? 0) + value);

/** Açık siparişler, stok, açık iş emirleri ve aktif reçetelerden net ihtiyaç raporu. */
export async function getMrpReport() {
  const supabase = await createClient();

  const [ordersRes, stockRes, warehousesRes, workOrdersRes, bomsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, no, delivery_date, items:order_items(product_id, quantity, delivered_qty)")
      .in("status", ["open", "in_production"]),
    supabase.from("v_stock").select("product_id, warehouse_id, qty"),
    supabase.from("warehouses").select("id, type"),
    supabase
      .from("work_orders")
      .select("product_id, planned_qty, entries:production_entries(produced_qty)")
      .neq("status", "done"),
    supabase
      .from("boms")
      .select(`
        product_id, code, version, production_type, created_at,
        items:bom_items(component_product_id, ratio_pct),
        injection:bom_injection(product_weight_g, runner_sprue_weight_g, cavity_count),
        extrusion:bom_extrusion(kg_per_meter, scrap_pct)
      `)
      .eq("active", true),
  ]);

  for (const res of [ordersRes, stockRes, warehousesRes, workOrdersRes, bomsRes]) {
    if (res.error) throw new Error("İhtiyaç verileri getirilirken hata oluştu: " + res.error.message);
  }

  // Kalan sipariş (teslim edilmemiş) + en yakın termin
  const demand = new Map<string, number>();
  const earliestDue = new Map<string, string>();
  for (const order of ordersRes.data ?? []) {
    for (const item of order.items ?? []) {
      const remaining = Number(item.quantity) - Number(item.delivered_qty ?? 0);
      if (remaining <= 0) continue;
      sumInto(demand, item.product_id, remaining);
      if (order.delivery_date && (!earliestDue.has(item.product_id) || order.delivery_date < earliestDue.get(item.product_id)!)) {
        earliestDue.set(item.product_id, order.delivery_date);
      }
    }
  }

  // Kullanılabilir stok (hurda/karantina hariç)
  const excluded = new Set((warehousesRes.data ?? []).filter((w) => EXCLUDED_WAREHOUSE_TYPES.has(w.type)).map((w) => w.id));
  const stock = new Map<string, number>();
  for (const s of stockRes.data ?? []) {
    if (!s.product_id || !s.warehouse_id || excluded.has(s.warehouse_id)) continue;
    sumInto(stock, s.product_id, Number(s.qty ?? 0));
  }

  // Açık iş emirlerinin kalan üretimi
  const openWorkOrders = new Map<string, number>();
  for (const wo of workOrdersRes.data ?? []) {
    const produced = (wo.entries ?? []).reduce((s, e) => s + Number(e.produced_qty || 0), 0);
    const remaining = Number(wo.planned_qty) - produced;
    if (remaining > 0) sumInto(openWorkOrders, wo.product_id, remaining);
  }

  // Ürün başına en son oluşturulan aktif reçete (farklı kodlu reçetelerde versiyon karşılaştırılamaz)
  const boms = new Map<string, MrpBom>();
  const activeCount = new Map<string, number>();
  for (const b of bomsRes.data ?? []) activeCount.set(b.product_id, (activeCount.get(b.product_id) ?? 0) + 1);
  for (const b of (bomsRes.data ?? []).sort((a, z) => (a.created_at ?? "").localeCompare(z.created_at ?? ""))) {
    const inj = one(b.injection);
    const ext = one(b.extrusion);
    boms.set(b.product_id, {
      code: b.code,
      version: b.version,
      otherActiveCount: (activeCount.get(b.product_id) ?? 1) - 1,
      productionType: b.production_type,
      kgPerUnit: bomKgPerUnit({
        productionType: b.production_type,
        productWeightG: inj?.product_weight_g,
        runnerSprueWeightG: inj?.runner_sprue_weight_g,
        cavityCount: inj?.cavity_count,
        kgPerMeter: ext?.kg_per_meter,
        scrapPct: ext?.scrap_pct,
      }),
      items: (b.items ?? []).map((i) => ({ productId: i.component_product_id, ratioPct: i.ratio_pct })),
    });
  }

  // Sadece ilgili ürünlerin kartları
  const ids = new Set<string>([...demand.keys(), ...openWorkOrders.keys()]);
  for (const id of ids) boms.get(id)?.items.forEach((i) => ids.add(i.productId));
  const { data: productRows, error: productError } = ids.size
    ? await supabase.from("products").select("id, code, name, unit, type").in("id", [...ids])
    : { data: [], error: null };
  if (productError) throw new Error("Ürünler getirilirken hata oluştu: " + productError.message);
  const products = new Map<string, MrpProduct>(productRows.map((p) => [p.id, p]));

  const result = computeMrp({ products, demand, stock, openWorkOrders, boms });
  return {
    ...result,
    finished: result.finished.map((f) => ({ ...f, earliestDue: earliestDue.get(f.product.id) ?? null })),
    materials: result.materials.map((m) => ({ ...m, earliestDue: earliestDue.get(m.product.id) ?? null })),
    openOrderCount: ordersRes.data?.length ?? 0,
  };
}

export type MrpReport = Awaited<ReturnType<typeof getMrpReport>>;
