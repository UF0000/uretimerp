/**
 * Üretim analiz panosu hesapları (saf fonksiyon; veritabanından bağımsız, test edilebilir).
 *
 * Tanımlar (kütle bazlı):
 *   Sağlam kg        = hammadde − fire
 *   Fire %           = fire / hammadde
 *   Overweight %     = sağlam / nominal − 1   (nominal = üretilen × reçete birim ağırlığı)
 *   Materyal verim   = sağlam / hammadde
 *   OEE              = kullanılabilirlik × performans × kalite (v_oee_entries ile aynı)
 * Kapasite (hat kg/saat kapasitesi girilmiş girişler):
 *   NŞA kapasite     = Σ hat kapasitesi × dönemin takvim saati
 *   Kapasite verimi  = hammadde / NŞA kapasite
 *   Aktif sürede kap.= hammadde / Σ(kapasite × çalışma saati)
 *   Zaman kullanımı  = Σ çalışma saati / (hat sayısı × takvim saati)
 *   Beklenen üretim  = Σ(kapasite × çalışma saati)
 */

export interface AnalyticsEntry {
  entryId: string;
  day: string;
  shift: "day" | "night";
  workOrderId: string;
  workOrderNo: string;
  productId: string;
  productCode: string;
  productName: string;
  productUnit: string;
  bomCode: string;
  lineId: string | null;
  usedKg: number;
  scrapKg: number;
  goodKg: number;
  producedQty: number;
  nominalKg: number | null;
  plannedMin: number;
  runMin: number;
  downtimeMin: number;
  scrapReasonId: string | null;
  downtimeReasonId: string | null;
  capacityKgPerHour: number | null;
  /** OEE performansı için ideal süre (sn); veri yoksa null */
  idealSec: number | null;
}

export interface EntryMaterial {
  entryId: string;
  productId: string;
  code: string;
  name: string;
  kg: number;
}

export interface EntryScrapTarget {
  entryId: string;
  /** Fire ürününün tipi: regrind = geri dönüştürülür, scrap = hurda/kayıp */
  type: "regrind" | "scrap";
  kg: number;
}

export interface AnalyticsInput {
  entries: AnalyticsEntry[];
  materials: EntryMaterial[];
  scrapTargets: EntryScrapTarget[];
  reasons: Map<string, { code: string; label: string }>;
  /** Kapsamdaki hatlar (kapasite hesabı için) */
  lines: { id: string; name: string; capacityKgPerHour: number | null }[];
  calendarHours: number;
  targets: { scrapPct: number; overweightTolerancePct: number; oeePct: number };
}

const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/** Bir giriş grubunun ortak ölçüleri */
function measure(entries: AnalyticsEntry[]) {
  const usedKg = sum(entries, (e) => e.usedKg);
  const scrapKg = sum(entries, (e) => e.scrapKg);
  const goodKg = sum(entries, (e) => e.goodKg);
  const withNominal = entries.filter((e) => e.nominalKg && e.nominalKg > 0);
  const nominalKg = sum(withNominal, (e) => e.nominalKg!);
  const goodForNominal = sum(withNominal, (e) => e.goodKg);
  const plannedMin = sum(entries, (e) => e.plannedMin);
  const runMin = sum(entries, (e) => e.runMin);
  const withIdeal = entries.filter((e) => e.idealSec !== null);
  const idealSec = sum(withIdeal, (e) => e.idealSec!);
  const perfRunSec = sum(withIdeal, (e) => e.runMin * 60);

  const availability = ratio(runMin, plannedMin);
  const performance = ratio(idealSec, perfRunSec);
  const quality = ratio(goodKg, usedKg);
  const oee =
    availability !== null && performance !== null && quality !== null
      ? availability * Math.min(performance, 1) * quality
      : null;

  const withCap = entries.filter((e) => e.capacityKgPerHour && e.capacityKgPerHour > 0);
  const expectedKg = sum(withCap, (e) => (e.capacityKgPerHour! * e.runMin) / 60);

  return {
    entries: entries.length,
    usedKg,
    scrapKg,
    goodKg,
    producedM: sum(entries.filter((e) => e.productUnit === "metre"), (e) => e.producedQty),
    producedPcs: sum(entries.filter((e) => e.productUnit === "adet"), (e) => e.producedQty),
    scrapPct: ratio(scrapKg, usedKg),
    overweightPct: nominalKg > 0 ? goodForNominal / nominalKg - 1 : null,
    materialYield: quality,
    availability,
    performance,
    oee,
    runHours: runMin / 60,
    downtimeHours: sum(entries, (e) => e.downtimeMin) / 60,
    expectedKg,
    /** Hammadde / (kapasite × çalışma saati), kapasitesi bilinen girişlerde */
    activeCapacityPct: ratio(sum(withCap, (e) => e.usedKg), expectedKg),
  };
}

export type GroupMeasure = ReturnType<typeof measure>;

function groupBy<T>(xs: T[], key: (x: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const list = m.get(k);
    if (list) list.push(x);
    else m.set(k, [x]);
  }
  return m;
}

export function computeProductionAnalytics(input: AnalyticsInput) {
  const { entries, materials, scrapTargets, reasons, lines, calendarHours, targets } = input;
  const total = measure(entries);

  // ── Kapasite ──
  const capLines = lines.filter((l) => l.capacityKgPerHour && l.capacityKgPerHour > 0);
  const nsaCapacityKg = sum(capLines, (l) => l.capacityKgPerHour! * calendarHours);
  const capEntries = entries.filter((e) => e.capacityKgPerHour && e.capacityKgPerHour > 0);
  const capRunHours = sum(capEntries, (e) => e.runMin / 60);
  const capacity = {
    linesWithCapacity: capLines.length,
    linesWithoutCapacity: lines.length - capLines.length,
    weightedCapacityKgPerHour: capRunHours > 0 ? sum(capEntries, (e) => (e.capacityKgPerHour! * e.runMin) / 60) / capRunHours : null,
    nsaCapacityKg,
    capacityEfficiency: ratio(sum(capEntries, (e) => e.usedKg), nsaCapacityKg),
    activeCapacityPct: total.activeCapacityPct,
    timeUtilization: ratio(capRunHours, capLines.length * calendarHours),
    expectedKg: total.expectedKg,
  };

  // ── Hammadde dağılımı ve özet (fire/sağlam, girişteki tüketim payına göre dağıtılır) ──
  const entryById = new Map(entries.map((e) => [e.entryId, e]));
  const matByEntry = groupBy(materials.filter((m) => entryById.has(m.entryId)), (m) => m.entryId);
  const scrapByEntry = groupBy(scrapTargets.filter((s) => entryById.has(s.entryId)), (s) => s.entryId);
  const rawSummary = new Map<string, { code: string; name: string; usedKg: number; goodKg: number; scrapKg: number; regrindKg: number; lostKg: number; workOrders: Set<string> }>();
  for (const [entryId, mats] of matByEntry) {
    const e = entryById.get(entryId)!;
    const entryMatKg = sum(mats, (m) => m.kg);
    const regrind = sum((scrapByEntry.get(entryId) ?? []).filter((s) => s.type === "regrind"), (s) => s.kg);
    for (const m of mats) {
      const share = entryMatKg > 0 ? m.kg / entryMatKg : 0;
      const row = rawSummary.get(m.productId) ?? { code: m.code, name: m.name, usedKg: 0, goodKg: 0, scrapKg: 0, regrindKg: 0, lostKg: 0, workOrders: new Set<string>() };
      row.usedKg += m.kg;
      row.goodKg += e.goodKg * share;
      row.scrapKg += e.scrapKg * share;
      row.regrindKg += regrind * share;
      row.lostKg += (e.scrapKg - regrind) * share;
      row.workOrders.add(e.workOrderId);
      rawSummary.set(m.productId, row);
    }
  }
  const rawMaterials = [...rawSummary.entries()]
    .map(([productId, r]) => ({
      productId,
      code: r.code,
      name: r.name,
      usedKg: r.usedKg,
      goodKg: r.goodKg,
      scrapKg: r.scrapKg,
      regrindKg: r.regrindKg,
      lostKg: Math.max(0, r.lostKg),
      yieldPct: ratio(r.goodKg, r.usedKg),
      scrapPct: ratio(r.scrapKg, r.usedKg),
      workOrders: r.workOrders.size,
    }))
    .sort((a, b) => b.usedKg - a.usedKg);

  // ── Neden kodları (Pareto) ──
  const pareto = (pick: (e: AnalyticsEntry) => [string | null, number]) => {
    const m = new Map<string, number>();
    for (const e of entries) {
      const [id, v] = pick(e);
      if (id && v > 0) m.set(id, (m.get(id) ?? 0) + v);
    }
    const total = sum([...m.values()], (v) => v);
    return [...m.entries()]
      .map(([id, value]) => ({ id, code: reasons.get(id)?.code ?? "?", label: reasons.get(id)?.label ?? "Bilinmeyen", value, share: total > 0 ? value / total : 0 }))
      .sort((a, b) => b.value - a.value);
  };

  // ── Vardiya karşılaştırması ──
  const shifts = (["day", "night"] as const).map((s) => {
    // Vardiyada tüketilen hammadde, aileye göre
    const materialsKg: Record<string, number> = {};
    for (const [entryId, mats] of matByEntry) {
      if (entryById.get(entryId)!.shift !== s) continue;
      for (const m of mats) materialsKg[m.name] = (materialsKg[m.name] ?? 0) + m.kg;
    }
    return { shift: s, materialsKg, ...measure(entries.filter((e) => e.shift === s)) };
  });

  // ── İş emri bazında ──
  const workOrders = [...groupBy(entries, (e) => e.workOrderId).values()].map((list) => {
    const first = list[0];
    const m = measure(list);
    const scrapOut = m.scrapPct !== null && m.scrapPct * 100 > targets.scrapPct;
    const owOut = m.overweightPct !== null && Math.abs(m.overweightPct * 100) > targets.overweightTolerancePct;
    return {
      workOrderId: first.workOrderId,
      workOrderNo: first.workOrderNo,
      productCode: first.productCode,
      productName: first.productName,
      productUnit: first.productUnit,
      bomCode: first.bomCode,
      ...m,
      outOfTarget: scrapOut || owOut,
      scrapDeviation: m.scrapPct !== null ? m.scrapPct * 100 - targets.scrapPct : null,
      overweightDeviation: m.overweightPct !== null ? Math.abs(m.overweightPct * 100) - targets.overweightTolerancePct : null,
    };
  });

  // Kontrol öncelikleri: hedef dışı iş emirleri, en büyük sapma önce
  const priorities = workOrders
    .filter((w) => w.outOfTarget)
    .map((w) => ({ ...w, severity: Math.max(w.scrapDeviation ?? -Infinity, w.overweightDeviation ?? -Infinity) }))
    .sort((a, b) => b.severity - a.severity);

  return {
    total,
    capacity,
    rawMaterials,
    scrapReasons: pareto((e) => [e.scrapReasonId, e.scrapKg]),
    downtimeReasons: pareto((e) => [e.downtimeReasonId, e.downtimeMin]),
    shifts,
    workOrders: workOrders.sort((a, b) => (a.materialYield ?? 1) - (b.materialYield ?? 1)),
    priorities,
    outOfTargetCount: priorities.length,
    targets,
  };
}

export type ProductionAnalytics = ReturnType<typeof computeProductionAnalytics>;
