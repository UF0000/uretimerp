/**
 * MRP — net ihtiyaç hesabı (saf fonksiyon; veritabanından bağımsız, test edilebilir).
 *
 * Mamul:   üretilmesi gereken = max(0, kalan sipariş − kullanılabilir stok)
 *          planlanan üretim   = max(üretilmesi gereken, açık iş emri kalanı)
 *          iş emri açılmalı   = max(0, üretilmesi gereken − açık iş emri kalanı)
 * Hammadde: brüt = Σ planlanan üretim × birim ağırlık (kg) × reçete oranı
 *           + reçetesiz ürünlerin doğrudan sipariş ihtiyacı (satın alma)
 *           net eksik = max(0, brüt − kullanılabilir stok)
 * Negatif stok 0 sayılır. Reçete tek seviyeli patlatılır.
 */

export interface MrpProduct {
  id: string;
  code: string;
  name: string;
  unit: string;
  type: string;
}

export interface MrpBom {
  version: number;
  productionType: "extrusion" | "injection";
  /** Bir birim mamul için harcanan hammadde (kg); reçetede ağırlık yoksa null */
  kgPerUnit: number | null;
  items: { productId: string; ratioPct: number | null }[];
}

export interface MrpInput {
  products: Map<string, MrpProduct>;
  /** Ürün başına kalan sipariş miktarı (teslim edilmemiş) */
  demand: Map<string, number>;
  /** Ürün başına kullanılabilir stok (hurda/karantina hariç) */
  stock: Map<string, number>;
  /** Ürün başına açık iş emirlerinin kalan üretim miktarı */
  openWorkOrders: Map<string, number>;
  /** Ürün başına aktif (en yüksek versiyon) reçete */
  boms: Map<string, MrpBom>;
}

export interface MrpFinishedRow {
  product: MrpProduct;
  demand: number;
  stock: number;
  openWorkOrderQty: number;
  netProduction: number;
  toSchedule: number;
  plannedProduction: number;
  bomVersion: number | null;
  kgPerUnit: number | null;
  warning: string | null;
}

export interface MrpMaterialRow {
  product: MrpProduct;
  gross: number;
  stock: number;
  net: number;
  /** Bu hammaddeye ihtiyaç doğuran ürünler ve miktarları (kg / birim) */
  sources: { code: string; qty: number; reason: "production" | "purchase" }[];
}

/** Negatif veya tanımsız stok kullanılabilir 0 kabul edilir. */
const usable = (v: number | undefined) => Math.max(0, v ?? 0);
const round = (v: number, d = 4) => Math.round(v * 10 ** d) / 10 ** d;

export function computeMrp(input: MrpInput): { finished: MrpFinishedRow[]; materials: MrpMaterialRow[] } {
  const { products, demand, stock, openWorkOrders, boms } = input;
  const finished: MrpFinishedRow[] = [];
  const materials = new Map<string, MrpMaterialRow>();

  const addMaterial = (productId: string, qty: number, source: MrpMaterialRow["sources"][number]) => {
    const product = products.get(productId);
    if (!product || qty <= 0) return;
    const row = materials.get(productId) ?? { product, gross: 0, stock: usable(stock.get(productId)), net: 0, sources: [] };
    row.gross += qty;
    row.sources.push({ ...source, qty: round(source.qty) });
    materials.set(productId, row);
  };

  // Siparişi veya açık iş emri olan her ürün
  const productIds = new Set([...demand.keys(), ...openWorkOrders.keys()]);
  for (const productId of productIds) {
    const product = products.get(productId);
    if (!product) continue;
    const bom = boms.get(productId);
    const dem = demand.get(productId) ?? 0;

    // Reçetesiz ürün: doğrudan satın alma ihtiyacı
    if (!bom) {
      if (dem > 0) addMaterial(productId, dem, { code: product.code, qty: dem, reason: "purchase" });
      continue;
    }

    const st = usable(stock.get(productId));
    const wo = openWorkOrders.get(productId) ?? 0;
    const netProduction = Math.max(0, dem - st);
    const plannedProduction = Math.max(netProduction, wo);
    const ratioSum = bom.items.reduce((s, i) => s + (i.ratioPct ?? 0), 0);

    let warning: string | null = null;
    if (plannedProduction > 0 && bom.kgPerUnit === null) {
      warning = "Reçetede birim ağırlık yok (enjeksiyon: parça ağırlığı, ekstrüzyon: kg/m); hammadde hesaplanamadı.";
    } else if (plannedProduction > 0 && Math.abs(ratioSum - 100) > 0.5) {
      warning = `Reçete oranlarının toplamı %${round(ratioSum, 2)}; hammadde dağılımı eksik/fazla olabilir.`;
    }

    if (plannedProduction > 0 && bom.kgPerUnit !== null) {
      const totalKg = plannedProduction * bom.kgPerUnit;
      for (const item of bom.items) {
        if (!item.ratioPct) continue;
        addMaterial(item.productId, (totalKg * item.ratioPct) / 100, {
          code: product.code,
          qty: (totalKg * item.ratioPct) / 100,
          reason: "production",
        });
      }
    }

    finished.push({
      product,
      demand: dem,
      stock: st,
      openWorkOrderQty: wo,
      netProduction,
      toSchedule: Math.max(0, netProduction - wo),
      plannedProduction,
      bomVersion: bom.version,
      kgPerUnit: bom.kgPerUnit,
      warning,
    });
  }

  const materialRows = [...materials.values()].map((m) => ({
    ...m,
    gross: round(m.gross),
    net: round(Math.max(0, m.gross - m.stock)),
  }));

  return {
    finished: finished.sort((a, b) => b.toSchedule - a.toSchedule || a.product.code.localeCompare(b.product.code)),
    materials: materialRows.sort((a, b) => b.net - a.net || a.product.code.localeCompare(b.product.code)),
  };
}

/**
 * Reçeteden bir birim mamul için hammadde (kg).
 * Enjeksiyon: (parça g + yolluk g / göz) / 1000. Ekstrüzyon: kg/m × (1 + hedef fire %).
 */
export function bomKgPerUnit(bom: {
  productionType: "extrusion" | "injection";
  productWeightG?: number | null;
  runnerSprueWeightG?: number | null;
  cavityCount?: number | null;
  kgPerMeter?: number | null;
  scrapPct?: number | null;
}): number | null {
  if (bom.productionType === "injection") {
    if (!bom.productWeightG || bom.productWeightG <= 0) return null;
    const cavity = Math.max(1, bom.cavityCount ?? 1);
    return (bom.productWeightG + (bom.runnerSprueWeightG ?? 0) / cavity) / 1000;
  }
  if (!bom.kgPerMeter || bom.kgPerMeter <= 0) return null;
  return bom.kgPerMeter * (1 + (bom.scrapPct ?? 0) / 100);
}
