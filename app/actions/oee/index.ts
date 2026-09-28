"use server";

import { createClient } from "@/lib/supabase/server";

/** Ham OEE bileşenlerinin toplamı; oranlar bu toplamlardan ağırlıklı hesaplanır. */
interface OeeSums {
  entries: number;
  plannedSec: number;
  runSec: number;
  /** Sadece ideal verisi olan girişlerin çalışma süresi (performans paydası) */
  perfRunSec: number;
  idealSec: number;
  perfEntries: number;
  goodKg: number;
  totalKg: number;
  downtimeMin: number;
  scrapKg: number;
}

export interface OeeMetrics {
  entries: number;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
  /** Performans verisi (ideal çevrim/hız) olan girişlerin oranı */
  performanceCoverage: number;
  downtimeMin: number;
  scrapKg: number;
}

const emptySums = (): OeeSums => ({
  entries: 0, plannedSec: 0, runSec: 0, perfRunSec: 0, idealSec: 0,
  perfEntries: 0, goodKg: 0, totalKg: 0, downtimeMin: 0, scrapKg: 0,
});

const toMetrics = (s: OeeSums): OeeMetrics => {
  const availability = s.plannedSec > 0 ? s.runSec / s.plannedSec : null;
  // Performans %100'ü aşabilir (ideal değer iyimser girilmişse); OEE'de 1 ile sınırlanır
  const performance = s.perfRunSec > 0 ? s.idealSec / s.perfRunSec : null;
  const quality = s.totalKg > 0 ? s.goodKg / s.totalKg : null;
  const oee =
    availability !== null && performance !== null && quality !== null
      ? availability * Math.min(performance, 1) * quality
      : null;
  return {
    entries: s.entries,
    availability,
    performance,
    quality,
    oee,
    performanceCoverage: s.entries > 0 ? s.perfEntries / s.entries : 0,
    downtimeMin: s.downtimeMin,
    scrapKg: s.scrapKg,
  };
};

/**
 * Son `days` gündeki vardiya girişlerinden OEE raporu:
 * genel, makine (hat/kalıp) bazında, günlük, duruş ve fire nedenleri (Pareto).
 */
export async function getOeeReport(days: number) {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [entriesRes, linesRes, moldsRes, reasonsRes, paramsRes] = await Promise.all([
    supabase.from("v_oee_entries").select("*").gte("day", since).order("day"),
    supabase.from("production_lines").select("id, code, name"),
    supabase.from("molds").select("id, code, name"),
    supabase.from("reason_codes").select("id, code, label"),
    supabase.from("cost_parameters").select("shift_minutes").limit(1).maybeSingle(),
  ]);
  if (entriesRes.error) throw new Error("OEE verileri getirilirken hata oluştu: " + entriesRes.error.message);

  const lineById = new Map((linesRes.data ?? []).map((l) => [l.id, l]));
  const moldById = new Map((moldsRes.data ?? []).map((m) => [m.id, m]));
  const reasonById = new Map((reasonsRes.data ?? []).map((r) => [r.id, r]));

  const total = emptySums();
  const byMachine = new Map<string, { label: string; kind: string; sums: OeeSums }>();
  const byDay = new Map<string, OeeSums>();
  const downtimeByReason = new Map<string, number>();
  const scrapByReason = new Map<string, number>();

  const add = (s: OeeSums, e: (typeof entriesRes.data)[number]) => {
    const run = Number(e.run_sec ?? 0);
    s.entries += 1;
    s.plannedSec += Number(e.planned_sec ?? 0);
    s.runSec += run;
    if (e.ideal_sec !== null) {
      s.idealSec += Number(e.ideal_sec);
      s.perfRunSec += run;
      s.perfEntries += 1;
    }
    s.goodKg += Number(e.good_kg ?? 0);
    s.totalKg += Number(e.total_kg ?? 0);
    s.downtimeMin += Number(e.downtime_min ?? 0);
    s.scrapKg += Number(e.scrap_kg ?? 0);
  };

  for (const e of entriesRes.data) {
    add(total, e);

    const line = e.line_id ? lineById.get(e.line_id) : undefined;
    const mold = e.mold_id ? moldById.get(e.mold_id) : undefined;
    const key = line?.id ?? mold?.id ?? "none";
    if (!byMachine.has(key)) {
      byMachine.set(key, {
        label: line ? `${line.name} (${line.code})` : mold ? `${mold.name} (${mold.code})` : "Hat/kalıp atanmamış",
        kind: line ? "Hat" : mold ? "Kalıp" : "-",
        sums: emptySums(),
      });
    }
    add(byMachine.get(key)!.sums, e);

    if (e.day) {
      if (!byDay.has(e.day)) byDay.set(e.day, emptySums());
      add(byDay.get(e.day)!, e);
    }

    if (Number(e.downtime_min) > 0 && e.downtime_reason_code_id) {
      downtimeByReason.set(e.downtime_reason_code_id, (downtimeByReason.get(e.downtime_reason_code_id) ?? 0) + Number(e.downtime_min));
    }
    if (Number(e.scrap_kg) > 0 && e.scrap_reason_code_id) {
      scrapByReason.set(e.scrap_reason_code_id, (scrapByReason.get(e.scrap_reason_code_id) ?? 0) + Number(e.scrap_kg));
    }
  }

  const pareto = (m: Map<string, number>) => {
    const rows = [...m.entries()]
      .map(([id, value]) => ({ id, code: reasonById.get(id)?.code ?? "?", label: reasonById.get(id)?.label ?? "Bilinmeyen", value }))
      .sort((a, b) => b.value - a.value);
    const sum = rows.reduce((s, r) => s + r.value, 0);
    let cumulative = 0;
    return rows.map((r) => {
      cumulative += r.value;
      return { ...r, share: sum > 0 ? r.value / sum : 0, cumulativeShare: sum > 0 ? cumulative / sum : 0 };
    });
  };

  return {
    days,
    since,
    shiftMinutes: Number(paramsRes.data?.shift_minutes ?? 720),
    total: toMetrics(total),
    machines: [...byMachine.values()]
      .map((m) => ({ label: m.label, kind: m.kind, ...toMetrics(m.sums) }))
      .sort((a, b) => (a.oee ?? -1) - (b.oee ?? -1)),
    daily: [...byDay.entries()].map(([day, s]) => ({ day, ...toMetrics(s) })),
    downtimePareto: pareto(downtimeByReason),
    scrapPareto: pareto(scrapByReason),
  };
}

export type OeeReport = Awaited<ReturnType<typeof getOeeReport>>;
