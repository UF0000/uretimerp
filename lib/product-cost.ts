/**
 * Ürün bazında standart (planlanan) birim maliyet — Maliyet sayfasıyla aynı mantık:
 *   Birim hammadde kg   = ekstrüzyon: kg/m · enjeksiyon: (parça g + yolluk g / göz) / 1000 · kg birimli ürün: 1
 *   Ort. hammadde ₺/kg  = reçete oranlarıyla ağırlıklı kart fiyatı (oran yoksa miktarla ağırlıklı)
 *   Hammadde            = birim kg × ort. ₺/kg
 *   İşçilik, enerji     = Yönetim → Parametreler (birim başına)
 *   Genel gider         = (hammadde + işçilik + enerji) × genel gider %
 */

export interface CostComponent {
  code: string;
  name: string;
  ratioPct: number | null;
  quantity: number;
  unitCost: number | null;
  currency: string | null;
}

export interface CostInput {
  unit: string;
  productionType: "extrusion" | "injection" | null;
  kgPerMeter: number | null;
  productWeightG: number | null;
  runnerWeightG: number | null;
  cavityCount: number | null;
  components: CostComponent[];
  params: { usdRate: number; eurRate: number; laborPerUnit: number; energyPerUnit: number; overheadPct: number };
}

export function computeStandardCost(input: CostInput) {
  const { params } = input;
  const priceTRY = (c: CostComponent) => {
    const cost = Number(c.unitCost || 0);
    if (c.currency === "USD") return cost * params.usdRate;
    if (c.currency === "EUR") return cost * params.eurRate;
    return cost;
  };

  const ratioSum = input.components.reduce((s, c) => s + Number(c.ratioPct || 0), 0);
  const qtySum = input.components.reduce((s, c) => s + Number(c.quantity || 0), 0);
  const weight = (c: CostComponent) => (ratioSum > 0 ? Number(c.ratioPct || 0) / ratioSum : qtySum > 0 ? Number(c.quantity || 0) / qtySum : 0);
  const avgKgPrice = input.components.reduce((s, c) => s + weight(c) * priceTRY(c), 0);

  let kgPerUnit: number | null = null;
  if (input.productionType === "extrusion" && input.kgPerMeter) kgPerUnit = input.kgPerMeter;
  else if (input.productionType === "injection" && input.productWeightG) {
    const cavity = Math.max(1, Number(input.cavityCount || 1));
    kgPerUnit = (input.productWeightG + Number(input.runnerWeightG || 0) / cavity) / 1000;
  } else if (input.unit === "kg") kgPerUnit = 1;

  const material = kgPerUnit !== null ? kgPerUnit * avgKgPrice : null;
  const labor = params.laborPerUnit;
  const energy = params.energyPerUnit;
  const overhead = (((material ?? 0) + labor + energy) * params.overheadPct) / 100;
  const total = material !== null ? material + labor + energy + overhead : null;

  const missing: string[] = [];
  if (!input.components.length) missing.push("reçetede hammadde yok");
  if (input.components.some((c) => !c.unitCost)) missing.push("fiyatı girilmemiş hammadde var");
  if (kgPerUnit === null) missing.push(input.productionType === "injection" ? "parça ağırlığı yok" : "metre ağırlığı (kg/m) yok");

  return {
    kgPerUnit,
    avgKgPrice,
    lines: input.components.map((c) => ({ ...c, priceTRY: priceTRY(c), share: weight(c) })),
    material,
    labor,
    energy,
    overhead,
    total,
    missing,
  };
}

export type StandardCost = ReturnType<typeof computeStandardCost>;
