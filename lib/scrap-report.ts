/**
 * Fire raporu hesapları (saf fonksiyon).
 *   Fire %        = fire kg / hammadde tüketimi kg
 *   Geri kazanım  = regrind'e ayrılan fire / toplam fire
 *   Kayıp         = fire − regrind (hurdaya giden)
 *   Pareto        = nedenlere göre fire kg, büyükten küçüğe, kümülatif pay
 */

export interface ScrapEntry {
  entryId: string;
  day: string; // YYYY-MM-DD
  shift: "day" | "night";
  productionType: "extrusion" | "injection";
  lineId: string | null;
  productId: string;
  productCode: string;
  productName: string;
  workOrderNo: string;
  operator: string | null;
  usedKg: number;
  scrapKg: number;
  scrapReasonId: string | null;
}

export interface ScrapInput {
  entries: ScrapEntry[];
  /** Girişte regrind deposuna ayrılan fire (kg) */
  regrindByEntry: Map<string, number>;
  reasons: Map<string, { code: string; label: string }>;
  lines: Map<string, string>;
  targetScrapPct: number;
}

const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/** Pazartesi başlangıçlı hafta (YYYY-MM-DD) */
const weekStart = (day: string) => {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

export function computeScrapReport(input: ScrapInput, opts: { bucket: "day" | "week" }) {
  const { entries, regrindByEntry, reasons, lines, targetScrapPct } = input;
  const regrindOf = (e: ScrapEntry) => Math.min(regrindByEntry.get(e.entryId) ?? 0, e.scrapKg);

  const measure = (list: ScrapEntry[]) => {
    const usedKg = sum(list, (e) => e.usedKg);
    const scrapKg = sum(list, (e) => e.scrapKg);
    const regrindKg = sum(list, regrindOf);
    return { usedKg, scrapKg, regrindKg, lostKg: Math.max(0, scrapKg - regrindKg), scrapPct: ratio(scrapKg, usedKg), entries: list.length };
  };

  const total = measure(entries);
  const totalScrap = total.scrapKg;

  const group = (key: (e: ScrapEntry) => string, label: (e: ScrapEntry) => string) => {
    const m = new Map<string, ScrapEntry[]>();
    for (const e of entries) {
      const k = key(e);
      const list = m.get(k);
      if (list) list.push(e);
      else m.set(k, [e]);
    }
    return [...m.entries()]
      .map(([k, list]) => {
        const x = measure(list);
        // En çok fire veren neden
        const byReason = new Map<string, number>();
        for (const e of list) if (e.scrapReasonId && e.scrapKg > 0) byReason.set(e.scrapReasonId, (byReason.get(e.scrapReasonId) ?? 0) + e.scrapKg);
        const top = [...byReason.entries()].sort((a, b) => b[1] - a[1])[0];
        return {
          key: k,
          label: label(list[0]),
          ...x,
          share: ratio(x.scrapKg, totalScrap) ?? 0,
          overTarget: x.scrapPct !== null && x.scrapPct * 100 > targetScrapPct,
          topReason: top ? (reasons.get(top[0])?.label ?? "Bilinmeyen") : null,
        };
      })
      .sort((a, b) => b.scrapKg - a.scrapKg);
  };

  // ── Neden Pareto'su (kümülatif) ──
  const reasonKg = new Map<string, number>();
  let unexplainedKg = 0;
  for (const e of entries) {
    if (e.scrapKg <= 0) continue;
    if (e.scrapReasonId) reasonKg.set(e.scrapReasonId, (reasonKg.get(e.scrapReasonId) ?? 0) + e.scrapKg);
    else unexplainedKg += e.scrapKg;
  }
  let cumulative = 0;
  const pareto = [...reasonKg.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, kg]) => {
      cumulative += kg;
      return {
        id,
        code: reasons.get(id)?.code ?? "?",
        label: reasons.get(id)?.label ?? "Bilinmeyen",
        kg,
        share: ratio(kg, totalScrap) ?? 0,
        cumulative: ratio(cumulative, totalScrap) ?? 0,
      };
    });
  // Fire'nin %80'ini açıklayan nedenler
  const vitalFew = pareto.filter((p, i) => i === 0 || pareto[i - 1].cumulative < 0.8).length;

  // ── Zaman serisi ──
  const bucketOf = (e: ScrapEntry) => (opts.bucket === "week" ? weekStart(e.day) : e.day);
  const trend = [...new Set(entries.map(bucketOf))].sort().map((period) => {
    const x = measure(entries.filter((e) => bucketOf(e) === period));
    return { period, scrapKg: x.scrapKg, scrapPct: x.scrapPct === null ? null : x.scrapPct * 100 };
  });

  return {
    total: {
      ...total,
      recoveryPct: ratio(total.regrindKg, total.scrapKg),
      unexplainedKg,
      entriesWithScrap: entries.filter((e) => e.scrapKg > 0).length,
    },
    targetScrapPct,
    pareto,
    vitalFew,
    trend,
    bucket: opts.bucket,
    byLine: group((e) => e.lineId ?? "-", (e) => (e.lineId ? (lines.get(e.lineId) ?? "Bilinmeyen hat") : "Hat yok")),
    byType: group((e) => e.productionType, (e) => (e.productionType === "extrusion" ? "Ekstrüzyon" : "Enjeksiyon")),
    byShift: group((e) => e.shift, (e) => (e.shift === "day" ? "Gündüz" : "Gece")),
    byProduct: group((e) => e.productId, (e) => `${e.productCode} — ${e.productName}`),
    byOperator: group((e) => (e.operator?.trim() || "-").toLocaleUpperCase("tr"), (e) => e.operator?.trim() || "Belirtilmemiş"),
  };
}

export type ScrapReport = ReturnType<typeof computeScrapReport>;
