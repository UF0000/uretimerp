"use server";

import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/utils";

type PricedProduct = { unit_cost: number | null; currency: string | null } | null;

/**
 * Tamamlanmış iş emirlerinin maliyeti.
 *
 * Gerçekleşen hammadde = iş emri için stoktan fiilen düşülen miktarlar × birim fiyat
 * (ters kaydı yapılmış hareketler hariç). Fire geri kazanımı = hurda deposuna giren
 * fire × hurda ürün fiyatı. Planlanan hammadde = üretilen × reçetedeki birim ağırlık
 * × reçete oranlarına göre ortalama kg fiyatı.
 *
 * Not: Fiyatlar ürün kartındaki güncel birim maliyetten alınır (geçmiş fiyat tutulmuyor).
 */
export async function getCompletedWorkOrdersForCosting() {
  const supabase = await createClient();

  const [{ data: workOrders, error }, { data: costParams }] = await Promise.all([
    supabase
      .from("work_orders")
      .select(`
        id, no, planned_qty, status, finished_at,
        product:products!product_id(id, code, name, unit),
        bom:boms(
          id, code, name, version, production_type,
          items:bom_items(
            ratio_pct,
            component:products!component_product_id(unit_cost, currency)
          ),
          injection:bom_injection(cavity_count, runner_sprue_weight_g, product_weight_g),
          extrusion:bom_extrusion(kg_per_meter)
        ),
        production:production_entries(produced_qty, scrap_qty)
      `)
      .eq("status", "done")
      .order("finished_at", { ascending: false }),
    supabase.from("cost_parameters").select("*").limit(1).maybeSingle(),
  ]);

  if (error) throw new Error("Maliyet verileri getirilirken hata oluştu: " + error.message);

  const usdRate = Number(costParams?.usd_rate || 1);
  const eurRate = Number(costParams?.eur_rate || 1);
  const laborPerUnit = Number(costParams?.labor_per_unit || 0);
  const energyPerUnit = Number(costParams?.energy_per_unit || 0);
  const overheadPct = Number(costParams?.overhead_pct || 0);

  /** Ürün kartındaki birim fiyatı TL'ye çevirir. */
  const priceTRY = (p: PricedProduct): number => {
    const cost = Number(p?.unit_cost || 0);
    if (p?.currency === "USD") return cost * usdRate;
    if (p?.currency === "EUR") return cost * eurRate;
    return cost;
  };

  // Bu iş emirlerinin tüm üretim/fire stok hareketleri
  const woIds = workOrders.map((wo) => wo.id);
  const { data: movements, error: movementError } = woIds.length
    ? await supabase
        .from("stock_movements")
        .select("id, source_id, source_type, direction, quantity, reverses_id, product:products(unit_cost, currency)")
        .in("source_id", woIds)
        .in("source_type", ["production", "scrap"])
    : { data: [], error: null };
  if (movementError) throw new Error("Stok hareketleri getirilirken hata oluştu: " + movementError.message);

  // İptal edilmiş hareketler ve ters kayıtların kendisi maliyete girmez
  const reversed = new Set(movements.map((m) => m.reverses_id).filter(Boolean));
  const effective = movements.filter((m) => !m.reverses_id && !reversed.has(m.id));

  return workOrders.map((wo) => {
    const produced = (wo.production ?? []).reduce((sum, e) => sum + Number(e.produced_qty || 0), 0);
    const scrapKg = (wo.production ?? []).reduce((sum, e) => sum + Number(e.scrap_qty || 0), 0);
    const woMoves = effective.filter((m) => m.source_id === wo.id);

    // Gerçekleşen hammadde: üretim kaynaklı çıkışlar
    const consumption = woMoves.filter((m) => m.source_type === "production" && m.direction === "out");
    const consumedKg = consumption.reduce((sum, m) => sum + Number(m.quantity), 0);
    const rawMaterialCost = consumption.reduce((sum, m) => sum + Number(m.quantity) * priceTRY(one(m.product)), 0);

    // Fire geri kazanımı: hurda deposuna girişler
    const scrapRecovery = woMoves
      .filter((m) => m.source_type === "scrap" && m.direction === "in")
      .reduce((sum, m) => sum + Number(m.quantity) * priceTRY(one(m.product)), 0);

    // Planlanan hammadde (reçeteden)
    const bom = one(wo.bom);
    const items = bom?.items ?? [];
    const ratioSum = items.reduce((sum, i) => sum + Number(i.ratio_pct || 0), 0);
    const avgKgPrice = ratioSum > 0
      ? items.reduce((sum, i) => sum + Number(i.ratio_pct || 0) * priceTRY(one(i.component)), 0) / ratioSum
      : 0;
    let plannedKgPerUnit: number | null = null;
    const inj = one(bom?.injection);
    const ext = one(bom?.extrusion);
    if (bom?.production_type === "injection" && inj?.product_weight_g) {
      const cavity = Math.max(1, Number(inj.cavity_count || 1));
      plannedKgPerUnit = (Number(inj.product_weight_g) + Number(inj.runner_sprue_weight_g || 0) / cavity) / 1000;
    } else if (bom?.production_type === "extrusion" && ext?.kg_per_meter) {
      plannedKgPerUnit = Number(ext.kg_per_meter);
    }
    const plannedMaterialCost = plannedKgPerUnit !== null ? produced * plannedKgPerUnit * avgKgPrice : null;

    const laborCost = produced * laborPerUnit;
    const energyCost = produced * energyPerUnit;
    const netMaterialCost = rawMaterialCost - scrapRecovery;
    const overheadCost = ((netMaterialCost + laborCost + energyCost) * overheadPct) / 100;
    const totalCost = netMaterialCost + laborCost + energyCost + overheadCost;

    return {
      id: wo.id,
      no: wo.no,
      finished_at: wo.finished_at,
      product: one(wo.product),
      bomVersion: bom?.version ?? null,
      bomLabel: bom ? `${bom.code} v${bom.version} · ${bom.name}` : null,
      metrics: {
        produced,
        scrapKg,
        consumedKg,
        rawMaterialCost,
        scrapRecovery,
        plannedMaterialCost,
        laborCost,
        energyCost,
        overheadCost,
        totalCost,
        unitCostFinal: produced > 0 ? totalCost / produced : 0,
      },
    };
  });
}

export type CostRow = Awaited<ReturnType<typeof getCompletedWorkOrdersForCosting>>[number];
