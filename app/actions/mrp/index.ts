"use server";

import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/utils";
import { bomKgPerUnit, computeMrp, type MrpBom, type MrpProduct } from "@/lib/mrp";
import type { PurchaseProduct, PurchaseSupplier } from "@/lib/purchase";
import { requirePermission } from "@/lib/auth";

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
      .select("product_id, planned_qty, entries:production_entries(produced_qty, cancelled_at)")
      .in("status", ["planned", "in_progress"]),
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
    const produced = (wo.entries ?? []).filter((e) => !e.cancelled_at).reduce((s, e) => s + Number(e.produced_qty || 0), 0);
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

/** Satın alma önerisi için veri: MRP eksikleri + minimum altı hammadde/ticari mal + ana tedarikçi ve son fiyat */
export async function getPurchaseData(mrp?: MrpReport) {
  await requirePermission("order:read");
  const supabase = await createClient();
  // Sayfa raporu zaten hesapladıysa tekrar hesaplanmaz
  const report = mrp ?? (await getMrpReport());
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });

  const [productsRes, stockRes, warehousesRes, suppliersRes] = await Promise.all([
    supabase.from("products").select("id, code, name, unit, type, min_stock").eq("active", true).in("type", ["raw", "trade"]),
    supabase.from("v_stock").select("product_id, warehouse_id, qty"),
    supabase.from("warehouses").select("id, type"),
    supabase
      .from("product_suppliers")
      .select("product_id, is_primary, supplier_code, lead_time_days, min_order_qty, created_at, partner:partners(id, name), prices:supplier_prices(price, currency, valid_from)"),
  ]);
  for (const res of [productsRes, stockRes, warehousesRes, suppliersRes]) {
    if (res.error) throw new Error("Satın alma verileri getirilirken hata oluştu: " + res.error.message);
  }

  const excluded = new Set((warehousesRes.data ?? []).filter((w) => EXCLUDED_WAREHOUSE_TYPES.has(w.type)).map((w) => w.id));
  const stock = new Map<string, number>();
  for (const s of stockRes.data ?? []) {
    if (!s.product_id || !s.warehouse_id || excluded.has(s.warehouse_id)) continue;
    sumInto(stock, s.product_id, Number(s.qty ?? 0));
  }

  // Ürün başına: ana tedarikçi (yoksa ilk eklenen) + bugüne kadar geçerli en yeni fiyat
  const suppliers: Record<string, PurchaseSupplier> = {};
  const sorted = [...(suppliersRes.data ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  for (const s of sorted) {
    if (suppliers[s.product_id]) continue;
    const partner = one(s.partner);
    const price = (s.prices ?? []).filter((p) => p.valid_from <= today).sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
    suppliers[s.product_id] = {
      partnerId: partner?.id ?? "",
      partnerName: partner?.name ?? "Tedarikçi",
      supplierCode: s.supplier_code,
      leadTimeDays: s.lead_time_days,
      minOrderQty: s.min_order_qty !== null ? Number(s.min_order_qty) : null,
      price: price ? Number(price.price) : null,
      currency: price?.currency ?? null,
    };
  }

  // Ürün kartları: satın alınan türler + MRP eksiklerinde geçen her ürün
  const products: Record<string, PurchaseProduct> = {};
  for (const p of productsRes.data ?? []) products[p.id] = { id: p.id, code: p.code, name: p.name, unit: p.unit, type: p.type, minStock: Number(p.min_stock) || 0 };
  const shortages = report.materials
    .filter((m) => m.net > 0)
    .map((m) => {
      products[m.product.id] ??= { id: m.product.id, code: m.product.code, name: m.product.name, unit: m.product.unit, type: m.product.type, minStock: 0 };
      return { productId: m.product.id, net: m.net, stock: m.stock, earliestDue: m.earliestDue };
    });
  const belowMin = (productsRes.data ?? [])
    .filter((p) => Number(p.min_stock) > 0 && (stock.get(p.id) ?? 0) < Number(p.min_stock))
    .map((p) => ({ productId: p.id, stock: stock.get(p.id) ?? 0 }));

  return { shortages, belowMin, products, suppliers };
}

export type PurchaseData = Awaited<ReturnType<typeof getPurchaseData>>;
