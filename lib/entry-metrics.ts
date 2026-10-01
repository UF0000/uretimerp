/**
 * Tek üretim girişinin göstergeleri (v_oee_entries / v_production_analytics ile aynı formüller).
 *   Planlı süre      = bitiş − başlangıç (dk);  çalışma = planlı − duruş
 *   Fire %           = fire kg / kullanılan hammadde kg
 *   Sağlam kg        = teorik: ekstrüzyon m × kg/m · enjeksiyon adet × parça g (yolluk hariç); yoksa hammadde − fire
 *   Overweight       = (hammadde − fire) / nominal − 1
 *     nominal: ekstrüzyon üretilen m × kg/m · enjeksiyon adet × (parça g + yolluk g / göz) / 1000
 *   Materyal verim   = (sağlam + yolluk) / hammadde
 *   OEE              = (planlı − duruş) / planlı  (fabrika tanımı: çalışma oranı)
 *   Hız performansı  = ideal süre / çalışma süresi (ayrı gösterge)
 *     enjeksiyon ideal = çevrim × sağlam adet / göz (DIA çevrim performansı)
 *     ekstrüzyon ideal = (sağlam m + fire m) / hedef hız
 *   Gerçekleşen      = enjeksiyon: çalışma sn / atış · ekstrüzyon: üretilen m / çalışma dk
 *   Kapasite kullanımı = kullanılan kg / (makine kapasitesi kg/sa × çalışma sa)
 */

export interface EntryTech {
  productionType: "extrusion" | "injection";
  kgPerMeter: number | null;
  targetMPerHour: number | null;
  cycleTimeSec: number | null;
  cavityCount: number | null;
  productWeightG: number | null;
  runnerWeightG: number | null;
  capacityKgPerHour: number | null;
}

export interface EntryInput {
  plannedMin: number;
  downtimeMin: number;
  producedQty: number;
  usedKg: number;
  scrapKg: number;
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/** İlk pozitif değer (reçetede 0/boş girilmiş alan kalıp kartındaki değere düşer) */
export const firstPositive = (...values: (number | null | undefined)[]) => values.find((v): v is number => typeof v === "number" && v > 0) ?? null;

/** Enjeksiyonda bir parçanın hammadde tüketimi (kg): parça + yolluk payı */
export const injectionKgPerPart = (t: Pick<EntryTech, "productWeightG" | "runnerWeightG" | "cavityCount">) =>
  t.productWeightG && t.productWeightG > 0 ? (t.productWeightG + (t.runnerWeightG ?? 0) / Math.max(1, t.cavityCount ?? 1)) / 1000 : null;

export function entryMetrics(e: EntryInput, t: EntryTech) {
  const runMin = Math.max(0, e.plannedMin - e.downtimeMin);
  const outKg = Math.max(0, e.usedKg - e.scrapKg);
  const cavity = Math.max(1, t.cavityCount ?? 1);

  let nominalKg: number | null = null;
  let runnerKg = 0;
  let idealSec: number | null = null;
  let actualCycleSec: number | null = null;
  let actualSpeedMPerMin: number | null = null;

  if (t.productionType === "extrusion") {
    if (t.kgPerMeter && t.kgPerMeter > 0) nominalKg = e.producedQty * t.kgPerMeter;
    if (t.targetMPerHour && t.targetMPerHour > 0) {
      const scrapM = t.kgPerMeter && t.kgPerMeter > 0 ? e.scrapKg / t.kgPerMeter : 0;
      idealSec = (3600 * (e.producedQty + scrapM)) / t.targetMPerHour;
    }
    actualSpeedMPerMin = runMin > 0 && e.producedQty > 0 ? e.producedQty / runMin : null;
  } else {
    const perPart = injectionKgPerPart(t);
    const shots = e.producedQty / cavity;
    if (perPart) nominalKg = e.producedQty * perPart;
    runnerKg = (shots * (t.runnerWeightG ?? 0)) / 1000;
    if (t.cycleTimeSec && t.cycleTimeSec > 0) idealSec = t.cycleTimeSec * shots;
    actualCycleSec = runMin > 0 && shots > 0 ? (runMin * 60) / shots : null;
  }

  const goodKg = nominalKg !== null && nominalKg > 0 ? Math.max(0, nominalKg - runnerKg) : outKg;
  const availability = ratio(runMin, e.plannedMin);
  const performance = idealSec !== null ? ratio(idealSec, runMin * 60) : null;
  const quality = ratio(goodKg + runnerKg, e.usedKg);
  const oee = availability; // fabrika tanımı: çalışma / planlı süre
  const expectedKg = t.capacityKgPerHour && t.capacityKgPerHour > 0 ? (t.capacityKgPerHour * runMin) / 60 : null;

  return {
    runMin,
    goodKg,
    scrapPct: ratio(e.scrapKg, e.usedKg),
    overweightPct: nominalKg && nominalKg > 0 ? outKg / nominalKg - 1 : null,
    availability,
    performance,
    quality,
    oee,
    actualCycleSec,
    actualSpeedMPerMin,
    capacityUse: expectedKg !== null ? ratio(e.usedKg, expectedKg) : null,
    kgPerHour: runMin > 0 ? (e.usedKg * 60) / runMin : null,
  };
}

export type EntryMetrics = ReturnType<typeof entryMetrics>;
