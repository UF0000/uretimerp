/**
 * Üretim analiz panosu hesapları (saf fonksiyon; veritabanından bağımsız, test edilebilir).
 *
 * Tanımlar (kütle bazlı; DIA boru/fitting raporlarıyla satır satır doğrulandı, 2026):
 *   Sağlam kg        = teorik ağırlık: boru üretilen m × kg/m · fitting adet × parça g (yolluk hariç);
 *                      reçetede ağırlık yoksa hammadde − fire
 *   Çıkan kg         = hammadde − fire (ürüne giren malzeme; fazla ağırlık dahil)
 *   Fire %           = fire / hammadde
 *   Overweight %     = çıkan / nominal − 1   (nominal = sağlam + yolluk payı)
 *   Materyal verim   = (sağlam + yolluk) / hammadde
 *   OEE              = (vardiya süresi − duruş) / vardiya süresi  (fabrika tanımı: çalışma oranı; toplamda Σnet / Σbrüt)
 *   Hız/çevrim perf. = ideal süre / gerçek çalışma süresi (enjeksiyon ideal = çevrim × sağlam adet / göz)
 * Kapasite (makine kapasitesi giriş gününde geçerli kayıttan):
 *   NŞA kapasite     = Σ gün Σ makine (o gün geçerli kapasite × kullanılabilir saat); tatil/kapalı gün düşülür
 *   Kapasite verimi  = hammadde / NŞA kapasite
 *   Zaman kullanımı  = Σ brüt (dolu) saat / Σ makine kullanılabilir saati
 *   Aktif sürede kap.= kapasite verimi / zaman kullanımı (grupta: hammadde / Σ(kapasite × brüt saat))
 *   Beklenen üretim  = Σ(kapasite × çalışma saati)
 * Referans (ürün grup × çap × SDR kg/saat; yoksa makine kapasitesi):
 *   Hız performansı  = hammadde / Σ(referans × çalışma saati)
 */

import type { MoldMode } from "@/lib/product-meta";

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
  operator: string | null;
  usedKg: number;
  scrapKg: number;
  /** Teorik sağlam ağırlık (yoksa hammadde − fire) */
  goodKg: number;
  /** Hammadde − fire (overweight hesabı) */
  outKg: number;
  producedQty: number;
  nominalKg: number | null;
  plannedMin: number;
  runMin: number;
  downtimeMin: number;
  scrapReasonId: string | null;
  downtimeReasonId: string | null;
  /** Çoklu neden satırları (varsa tek neden alanlarının yerine kullanılır) */
  scrapParts?: ReasonPart[];
  downtimeParts?: ReasonPart[];
  capacityKgPerHour: number | null;
  /** Ürünün grup/çap/SDR referans kapasitesi (kg/saat) */
  referenceKgPerHour: number | null;
  /** OEE performansı için ideal süre (sn); veri yoksa null */
  idealSec: number | null;
  /** Enjeksiyon: nominal yolluk (kg) = atış × atış başı yolluk */
  runnerKg?: number | null;
  /** Enjeksiyon: kalıp çalışma tipi */
  moldMode?: MoldMode | null;
}

export type ReasonPart = { reasonId: string; value: number };

/**
 * v_production_analytics satırından sağlam (teorik) ve çıkan kg.
 * Sağlam = nominal − yolluk (boruda yolluk yok); nominal yoksa hammadde − fire.
 */
export function soundKg(r: { used_kg: number | null; scrap_kg: number | null; nominal_kg: number | null; runner_kg?: number | null }) {
  const outKg = Math.max(0, Number(r.used_kg ?? 0) - Number(r.scrap_kg ?? 0));
  const nominal = r.nominal_kg === null ? null : Number(r.nominal_kg);
  const goodKg = nominal !== null && nominal > 0 ? Math.max(0, nominal - Number(r.runner_kg ?? 0)) : outKg;
  return { goodKg, outKg };
}

/** Girişin fire (kg) ya da duruş (dk) nedenleri: satırlar varsa onlar, yoksa tek neden alanı */
export function reasonParts(e: AnalyticsEntry, kind: "scrap" | "downtime"): ReasonPart[] {
  const parts = kind === "scrap" ? e.scrapParts : e.downtimeParts;
  if (parts?.length) return parts;
  const id = kind === "scrap" ? e.scrapReasonId : e.downtimeReasonId;
  const value = kind === "scrap" ? e.scrapKg : e.downtimeMin;
  return id && value > 0 ? [{ reasonId: id, value }] : [];
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
  /** Kapsamdaki makineler için önceden hesaplanmış kapasite (takvim ve geçerlilik tarihleriyle) */
  capacityScope: {
    lineCount: number;
    linesWithCapacity: number;
    /** Σ makine kullanılabilir saati (tatil/kapalı gün düşülmüş) */
    availableLineHours: number;
    nsaCapacityKg: number;
  };
  targets: { scrapPct: number; overweightTolerancePct: number; oeePct: number };
  /** Makine adı (kod + ad), makine bazlı kırılım için */
  lineNames: Map<string, string>;
  /** Trend gruplaması: kısa dönemde gün, uzun dönemde hafta */
  trendBucket: "day" | "week";
}

const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/** Bir giriş grubunun ortak ölçüleri (ürün kartı da kullanır) */
export function measure(entries: AnalyticsEntry[]) {
  const usedKg = sum(entries, (e) => e.usedKg);
  const scrapKg = sum(entries, (e) => e.scrapKg);
  const goodKg = sum(entries, (e) => e.goodKg);
  const runnerKg = sum(entries, (e) => e.runnerKg ?? 0);
  const withNominal = entries.filter((e) => e.nominalKg && e.nominalKg > 0);
  const nominalKg = sum(withNominal, (e) => e.nominalKg!);
  const outForNominal = sum(withNominal, (e) => e.outKg);
  const plannedMin = sum(entries, (e) => e.plannedMin);
  const runMin = sum(entries, (e) => e.runMin);
  const withIdeal = entries.filter((e) => e.idealSec !== null);
  const idealSec = sum(withIdeal, (e) => e.idealSec!);
  const perfRunSec = sum(withIdeal, (e) => e.runMin * 60);

  const availability = ratio(runMin, plannedMin);
  const performance = ratio(idealSec, perfRunSec);
  // Materyal verim: yolluk geri kazanılır, sağlam sayılır (DIA)
  const quality = ratio(goodKg + runnerKg, usedKg);
  // OEE fabrika tanımı: çalışma süresi / vardiya (planlı) süresi — 11 sa çalışma / 12 sa = %91,7
  const oee = availability;

  const withCap = entries.filter((e) => e.capacityKgPerHour && e.capacityKgPerHour > 0);
  const expectedKg = sum(withCap, (e) => (e.capacityKgPerHour! * e.runMin) / 60);
  const fullCapacityKg = sum(withCap, (e) => (e.capacityKgPerHour! * e.plannedMin) / 60);
  // Ürüne özel referans yoksa makine kapasitesi (DIA "genel makine standardı")
  const refRate = (e: AnalyticsEntry) => (e.referenceKgPerHour && e.referenceKgPerHour > 0 ? e.referenceKgPerHour : e.capacityKgPerHour && e.capacityKgPerHour > 0 ? e.capacityKgPerHour : null);
  const withRate = entries.filter((e) => refRate(e) !== null);
  const withRef = entries.filter((e) => e.referenceKgPerHour && e.referenceKgPerHour > 0);
  const referenceExpectedKg = sum(withRate, (e) => (refRate(e)! * e.runMin) / 60);

  return {
    entries: entries.length,
    usedKg,
    scrapKg,
    goodKg,
    producedM: sum(entries.filter((e) => e.productUnit === "metre"), (e) => e.producedQty),
    producedPcs: sum(entries.filter((e) => e.productUnit === "adet"), (e) => e.producedQty),
    scrapPct: ratio(scrapKg, usedKg),
    overweightPct: nominalKg > 0 ? outForNominal / nominalKg - 1 : null,
    materialYield: quality,
    availability,
    performance,
    oee,
    runHours: runMin / 60,
    /** Brüt üretim süresi (planlı / vardiya süresi, saat) */
    plannedHours: plannedMin / 60,
    runnerKg,
    downtimeHours: sum(entries, (e) => e.downtimeMin) / 60,
    expectedKg,
    /** Hammadde / (kapasite × brüt saat), kapasitesi bilinen girişlerde (= kapasite verimi ÷ zaman kullanımı) */
    activeCapacityPct: ratio(sum(withCap, (e) => e.usedKg), fullCapacityKg),
    referenceExpectedKg,
    /** Hız performansı: referans kapasiteye (yoksa makine kapasitesine) göre */
    speedPerformance: ratio(sum(withRate, (e) => e.usedKg), referenceExpectedKg),
    referenceCoverage: entries.length ? withRef.length / entries.length : 0,
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
  const { entries, materials, scrapTargets, reasons, capacityScope, targets, lineNames, trendBucket } = input;
  const total = measure(entries);
  // Çevrim performansı DIA'da yalnız yarı otomatik kalıplar için hesaplanır
  const semiAutoPerformance = measure(entries.filter((e) => e.moldMode === "yari_otomatik")).performance;

  // ── Kapasite ──
  const capEntries = entries.filter((e) => e.capacityKgPerHour && e.capacityKgPerHour > 0);
  const capRunHours = sum(capEntries, (e) => e.runMin / 60);
  const capacityEfficiency = ratio(sum(capEntries, (e) => e.usedKg), capacityScope.nsaCapacityKg);
  // Zaman kullanımı: dolu (brüt) makine saati / kullanılabilir saat (DIA)
  const timeUtilization = ratio(total.plannedHours, capacityScope.availableLineHours);
  const capacity = {
    linesWithCapacity: capacityScope.linesWithCapacity,
    linesWithoutCapacity: capacityScope.lineCount - capacityScope.linesWithCapacity,
    availableLineHours: capacityScope.availableLineHours,
    weightedCapacityKgPerHour: capRunHours > 0 ? sum(capEntries, (e) => (e.capacityKgPerHour! * e.runMin) / 60) / capRunHours : null,
    nsaCapacityKg: capacityScope.nsaCapacityKg,
    capacityEfficiency,
    // Aktif sürede kapasite verimi = kapasite verimi ÷ zaman kullanımı (DIA)
    activeCapacityPct: capacityEfficiency !== null && timeUtilization ? capacityEfficiency / timeUtilization : null,
    timeUtilization,
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
      // Sağlam çıktı: sağlam + yolluk (DIA hammadde tablosu)
      row.goodKg += (e.goodKg + (e.runnerKg ?? 0)) * share;
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
  const pareto = (kind: "scrap" | "downtime") => {
    const m = new Map<string, number>();
    for (const e of entries) for (const p of reasonParts(e, kind)) m.set(p.reasonId, (m.get(p.reasonId) ?? 0) + p.value);
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
      moldMode: first.moldMode ?? null,
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

  // ── Fire'nin regrind'e dönen kısmı ve kayıp (girişteki fireyi aşmaz) ──
  const regrindKgOf = (e: AnalyticsEntry) =>
    Math.min(sum((scrapByEntry.get(e.entryId) ?? []).filter((s) => s.type === "regrind"), (s) => s.kg), e.scrapKg);
  const regrindKg = sum(entries, regrindKgOf);
  const scrapRecovery = { regrindKg, lostKg: Math.max(0, total.scrapKg - regrindKg), recoveryPct: ratio(regrindKg, total.scrapKg) };

  // ── Kırılımlar: makine ve operatör (fire, duruş, OEE) ──
  const topReason = (list: AnalyticsEntry[], kind: "scrap" | "downtime") => {
    const m = new Map<string, number>();
    for (const e of list) for (const p of reasonParts(e, kind)) m.set(p.reasonId, (m.get(p.reasonId) ?? 0) + p.value);
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? (reasons.get(top[0])?.label ?? "Bilinmeyen") : null;
  };
  const breakdown = (key: (e: AnalyticsEntry) => string, label: (k: string) => string) =>
    [...groupBy(entries, key).entries()]
      .map(([k, list]) => ({
        key: k,
        label: label(k),
        ...measure(list),
        downtimeMin: sum(list, (e) => e.downtimeMin),
        topScrapReason: topReason(list, "scrap"),
        topDowntimeReason: topReason(list, "downtime"),
      }))
      .sort((a, b) => b.usedKg - a.usedKg);
  const byLine = breakdown((e) => e.lineId ?? "-", (k) => (k === "-" ? "Makine yok" : (lineNames.get(k) ?? "Bilinmeyen makine")));
  const byOperator = breakdown((e) => e.operator?.trim().toLocaleUpperCase("tr") || "-", (k) => (k === "-" ? "Belirtilmemiş" : k));
  const productNames = new Map(entries.map((e) => [e.productId, { code: e.productCode, name: e.productName }]));
  const byProduct = breakdown(
    (e) => e.productId,
    (k) => productNames.get(k)?.code ?? "?",
  ).map((r) => ({ ...r, productName: productNames.get(r.key)?.name ?? "" }));

  // ── Trend: gün ya da hafta bazında fire % ve OEE % ──
  const weekStart = (day: string) => {
    const d = new Date(day + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const bucketOf = (e: AnalyticsEntry) => (trendBucket === "week" ? weekStart(e.day) : e.day);
  const trend = [...groupBy(entries, bucketOf).entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, list]) => {
      const m = measure(list);
      return {
        period,
        usedKg: m.usedKg,
        scrapKg: m.scrapKg,
        scrapPct: m.scrapPct === null ? null : m.scrapPct * 100,
        oeePct: m.oee === null ? null : m.oee * 100,
        downtimeMin: sum(list, (e) => e.downtimeMin),
      };
    });

  return {
    total,
    semiAutoPerformance,
    capacity,
    scrapRecovery,
    byLine,
    byOperator,
    byProduct,
    trend,
    trendBucket,
    rawMaterials,
    scrapReasons: pareto("scrap"),
    downtimeReasons: pareto("downtime"),
    shifts,
    workOrders: workOrders.sort((a, b) => (a.materialYield ?? 1) - (b.materialYield ?? 1)),
    priorities,
    outOfTargetCount: priorities.length,
    targets,
  };
}

export type ProductionAnalytics = ReturnType<typeof computeProductionAnalytics>;
