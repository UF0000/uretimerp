/**
 * Tek üretim girişinin göstergeleri (v_oee_entries / v_production_analytics ile aynı formüller).
 *   Planlı süre      = bitiş − başlangıç (dk);  çalışma = planlı − duruş
 *   Fire %           = fire kg / kullanılan hammadde kg
 *   Overweight       = sağlam kg / (üretilen × reçete birim ağırlığı) − 1
 *   OEE              = kullanılabilirlik × min(performans, 1) × kalite
 *     enjeksiyon ideal = çevrim × atış (atış: ağırlık biliniyorsa kullanılan kütleden, yoksa adet / göz)
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

export function entryMetrics(e: EntryInput, t: EntryTech) {
  const runMin = Math.max(0, e.plannedMin - e.downtimeMin);
  const goodKg = Math.max(0, e.usedKg - e.scrapKg);
  const cavity = Math.max(1, t.cavityCount ?? 1);

  let nominalKg: number | null = null;
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
    if (t.productWeightG && t.productWeightG > 0) nominalKg = (e.producedQty * t.productWeightG) / 1000;
    if (t.cycleTimeSec && t.cycleTimeSec > 0) {
      const shots =
        t.productWeightG && t.productWeightG > 0 && e.usedKg > 0
          ? (e.usedKg * 1000) / (cavity * t.productWeightG + (t.runnerWeightG ?? 0))
          : e.producedQty / cavity;
      idealSec = t.cycleTimeSec * shots;
    }
    const shots = e.producedQty / cavity;
    actualCycleSec = runMin > 0 && shots > 0 ? (runMin * 60) / shots : null;
  }

  const availability = ratio(runMin, e.plannedMin);
  const performance = idealSec !== null ? ratio(idealSec, runMin * 60) : null;
  const quality = ratio(goodKg, e.usedKg);
  const oee = availability !== null && performance !== null && quality !== null ? availability * Math.min(performance, 1) * quality : null;
  const expectedKg = t.capacityKgPerHour && t.capacityKgPerHour > 0 ? (t.capacityKgPerHour * runMin) / 60 : null;

  return {
    runMin,
    goodKg,
    scrapPct: ratio(e.scrapKg, e.usedKg),
    overweightPct: nominalKg && nominalKg > 0 ? goodKg / nominalKg - 1 : null,
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
