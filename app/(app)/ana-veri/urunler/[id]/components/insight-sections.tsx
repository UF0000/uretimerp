import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import type { ProductInsights } from "@/app/actions/product-detail/insights";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ActualCostChart } from "./actual-cost-chart";

type Tone = "ok" | "warn" | "bad" | "neutral";
const TONE_TEXT: Record<Tone, string> = { ok: "text-success", warn: "text-warning", bad: "text-danger", neutral: "" };
const TONE_BORDER: Record<Tone, string> = { ok: "border-l-success", warn: "border-l-warning", bad: "border-l-danger", neutral: "border-l-border" };
const PILL: Record<Exclude<Tone, "neutral">, string> = { ok: "bg-success/15 text-success", warn: "bg-warning/20 text-warning-foreground", bad: "bg-danger/15 text-danger" };

const n0 = (v: number) => formatTR(v, 0);
const pct = (v: number | null, d = 1) => (v === null ? "—" : `%${formatTR(v * 100, d)}`);

const Kpi = ({ title, value, hint, tone = "neutral" }: { title: string; value: string; hint?: string; tone?: Tone }) => (
  <div className={cn("rounded-md border border-l-4 border-border px-3 py-2.5", TONE_BORDER[tone])}>
    <div className="text-xs text-muted-foreground">{title}</div>
    <div className={cn("text-xl font-semibold tabular-nums", TONE_TEXT[tone])}>{value}</div>
    {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
  </div>
);

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("whitespace-nowrap px-3 py-2 font-medium", right && "text-right")}>{children}</th>
);
const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-4 text-sm text-muted-foreground">{children}</p>;
const SubTitle = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 text-sm font-semibold">{children}</h3>;

const ORDER_STATUS: Record<string, string> = { open: "Açık", in_production: "Üretimde" };
const WO_STATUS: Record<string, string> = { planned: "Planlandı", in_progress: "Üretimde" };
const QC_TYPE: Record<string, string> = { incoming: "Giriş", process: "Proses", final: "Final" };
const QC_RESULT: Record<string, { label: string; tone: Exclude<Tone, "neutral"> }> = {
  accept: { label: "Kabul", tone: "ok" },
  conditional: { label: "Şartlı kabul", tone: "warn" },
  reject: { label: "Red", tone: "bad" },
};

// ─────────────────────────────── Stok ve rezervasyon ───────────────────────────────

export function StockSection({ insights, unit }: { insights: ProductInsights; unit: string }) {
  const { stock: s, depletion: d } = insights;
  const availableTone: Tone = s.available < 0 ? "bad" : s.reserved > 0 && s.available < s.reserved * 0.2 ? "warn" : "ok";
  const depletionTone: Tone = d.daysLeft === null ? "neutral" : d.daysLeft < 15 ? "bad" : d.daysLeft < 45 ? "warn" : "ok";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi title="Fiziksel stok" value={`${n0(s.physical)} ${unit}`} hint="tüm depolar" />
        <Kpi title="Kullanılabilir depolarda" value={`${n0(s.usableStock)} ${unit}`} hint="karantina/hurda/regrind hariç" />
        <Kpi title="Siparişe ayrılan" value={`${n0(s.reserved)} ${unit}`} hint={`${s.openOrders.length} açık sipariş`} tone={s.reserved > 0 ? "warn" : "neutral"} />
        <Kpi title="Kullanılabilir (boşta)" value={`${n0(s.available)} ${unit}`} hint="satılabilir miktar" tone={availableTone} />
        <Kpi title="Üretimde (açık iş emri)" value={`${n0(s.inProduction)} ${unit}`} hint={`iş emirleri bitince ${n0(s.projected)} ${unit}`} />
        <Kpi
          title="Tahmini tükenme"
          value={d.daysLeft === null ? "—" : `${n0(d.daysLeft)} gün`}
          hint={
            d.depletionDate
              ? `${formatDate(d.depletionDate)} · günde ~${formatTR(d.dailyOut, 0)} ${unit} ${d.outKind === "sale" ? "satış" : "tüketim"}`
              : `son 90 günde ${d.outKind === "sale" ? "satış" : "tüketim"} yok`
          }
          tone={depletionTone}
        />
      </div>
      {s.available < 0 && (
        <p className="flex items-start gap-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Açık siparişler kullanılabilir stoğu {n0(-s.available)} {unit} aşıyor; bu ürün yeni siparişe verilmeden önce üretim planlanmalı.
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <div>
          <SubTitle>Depo bazında stok</SubTitle>
          {s.byWarehouse.length === 0 ? (
            <Empty>Stok yok.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-muted-foreground">
                <tr>
                  <Th>Depo</Th>
                  <Th right>Miktar ({unit})</Th>
                </tr>
              </thead>
              <tbody>
                {s.byWarehouse.map((w) => (
                  <tr key={w.warehouseId} className="border-b border-border last:border-0 even:bg-muted/30">
                    <td className="px-3 py-2">
                      {w.name} {!w.usable && <Badge variant="outline">kullanılamaz</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{n0(w.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <SubTitle>Lotlar (eskiden yeniye)</SubTitle>
          {s.lots.length === 0 ? (
            <Empty>Lot kaydı yok.</Empty>
          ) : (
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
                  <tr>
                    <Th>Lot</Th>
                    <Th>Depo</Th>
                    <Th right>Miktar</Th>
                    <Th right>Yaş</Th>
                  </tr>
                </thead>
                <tbody>
                  {s.lots.map((l) => (
                    <tr key={`${l.lotNo}-${l.warehouse}`} className="border-b border-border last:border-0 even:bg-muted/30">
                      <td className="px-3 py-2 font-medium">
                        <Link href={`/depo/izlenebilirlik?lot=${encodeURIComponent(l.lotNo)}`} className="text-primary underline-offset-2 hover:underline">
                          {l.lotNo}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{l.warehouse}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{n0(l.qty)}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", l.ageDays !== null && l.ageDays > 180 && "text-warning")}>{l.ageDays === null ? "—" : `${l.ageDays} gün`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <SubTitle>Açık siparişler (teslim tarihine göre)</SubTitle>
          {s.openOrders.length === 0 ? (
            <Empty>Açık sipariş yok.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-muted-foreground">
                <tr>
                  <Th>Sipariş</Th>
                  <Th>Müşteri</Th>
                  <Th>Teslim</Th>
                  <Th right>Kalan ({unit})</Th>
                </tr>
              </thead>
              <tbody>
                {s.openOrders.map((o) => (
                  <tr key={`${o.orderId}-${o.no}`} className="border-b border-border last:border-0 even:bg-muted/30">
                    <td className="px-3 py-2 font-medium">
                      {o.no} <span className="text-xs font-normal text-muted-foreground">{ORDER_STATUS[o.status] ?? o.status}</span>
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2">{o.customer}</td>
                    <td className="px-3 py-2">{o.deliveryDate ? formatDate(o.deliveryDate) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n0(o.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <SubTitle>Açık iş emirleri</SubTitle>
          {s.openWorkOrders.length === 0 ? (
            <Empty>Açık iş emri yok.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-muted-foreground">
                <tr>
                  <Th>İş emri</Th>
                  <Th>Durum</Th>
                  <Th right>Planlanan</Th>
                  <Th right>Üretilen</Th>
                  <Th right>Kalan</Th>
                </tr>
              </thead>
              <tbody>
                {s.openWorkOrders.map((w) => (
                  <tr key={w.id} className="border-b border-border last:border-0 even:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{w.no}</td>
                    <td className="px-3 py-2">{WO_STATUS[w.status] ?? w.status}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n0(w.planned)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n0(w.produced)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n0(w.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────── Üretim performansı ───────────────────────────────

const Reasons = ({ title, rows, unit }: { title: string; rows: { label: string; value: number; share: number }[]; unit: string }) => (
  <div>
    <SubTitle>{title}</SubTitle>
    {rows.length === 0 ? (
      <Empty>Kayıt yok.</Empty>
    ) : (
      <ol className="space-y-1.5 text-sm">
        {rows.map((r, i) => (
          <li key={r.label} className="flex items-baseline justify-between gap-2">
            <span className="truncate">
              <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
              {r.label}
            </span>
            <span className="shrink-0 tabular-nums">
              {formatTR(r.value, 0)} {unit} <span className="text-xs text-muted-foreground">({pct(r.share, 0)})</span>
            </span>
          </li>
        ))}
      </ol>
    )}
  </div>
);

export function PerformanceSection({ insights }: { insights: ProductInsights }) {
  const p = insights.performance;
  const tg = insights.targets;
  if (!p) return <Empty>Son 12 ayda bu ürün için vardiya girişi yok.</Empty>;
  const scrapTone: Tone = p.scrapPct === null ? "neutral" : p.scrapPct * 100 <= tg.scrapPct ? "ok" : p.scrapPct * 100 <= tg.scrapPct * 1.2 ? "warn" : "bad";
  const owTone: Tone = p.overweightPct === null ? "neutral" : Math.abs(p.overweightPct * 100) <= tg.overweightTolerancePct ? "ok" : Math.abs(p.overweightPct * 100) <= tg.overweightTolerancePct * 1.2 ? "warn" : "bad";
  const oeeTone: Tone = p.oee === null ? "neutral" : p.oee * 100 >= tg.oeePct ? "ok" : p.oee * 100 >= tg.oeePct * 0.85 ? "warn" : "bad";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Kpi title="Sağlam üretim" value={`${n0(p.goodKg)} kg`} hint={`${p.workOrders} iş emri · ${p.entries} vardiya`} />
        <Kpi title="Ort. fire" value={pct(p.scrapPct, 2)} hint={`hedef ≤ %${formatTR(tg.scrapPct, 1)}`} tone={scrapTone} />
        <Kpi title="Ort. overweight" value={pct(p.overweightPct, 2)} hint={`tolerans ±%${formatTR(tg.overweightTolerancePct, 1)}`} tone={owTone} />
        <Kpi title="OEE" value={pct(p.oee)} hint={`çalışma / vardiya · hedef ≥ %${formatTR(tg.oeePct, 0)}`} tone={oeeTone} />
        <Kpi title="Duruş oranı" value={pct(p.availability === null ? null : 1 - p.availability)} hint="duruş / vardiya süresi" />
        <Kpi title="Hız performansı" value={pct(p.performance)} hint="ideal / gerçek süre" />
        <Kpi title="Referansa göre hız" value={pct(p.speedPerformance)} />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Reasons title="En sık fire nedenleri" rows={p.topScrap} unit="kg" />
        <Reasons title="En sık duruş nedenleri" rows={p.topDowntime} unit="dk" />
      </div>
      <p className="text-xs text-muted-foreground">
        Son 12 ay; hesaplar{" "}
        <Link href="/uretim/analiz" className="text-primary underline-offset-2 hover:underline">
          Üretim Analizi
        </Link>{" "}
        ile aynı.
      </p>
    </div>
  );
}

// ─────────────────────────────── Kalite ───────────────────────────────

export function QualitySection({ insights }: { insights: ProductInsights }) {
  const q = insights.quality;
  const total = q.counts.accept + q.counts.conditional + q.counts.reject;
  const openNcr = q.ncrs.filter((n) => n.status === "open").length;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi title="Kontrol" value={n0(total)} hint="son 50 kayıt" />
        <Kpi title="Kabul" value={total ? pct(q.counts.accept / total, 0) : "—"} hint={`${q.counts.accept} kontrol`} tone={total ? "ok" : "neutral"} />
        <Kpi title="Red / şartlı" value={total ? pct((q.counts.reject + q.counts.conditional) / total, 0) : "—"} hint={`${q.counts.reject} red · ${q.counts.conditional} şartlı`} tone={q.counts.reject > 0 ? "bad" : q.counts.conditional > 0 ? "warn" : "neutral"} />
        <Kpi title="Açık NCR" value={n0(openNcr)} hint={`${q.ncrs.length} toplam`} tone={openNcr > 0 ? "bad" : "ok"} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div>
          <SubTitle>Kalite kontrolleri</SubTitle>
          {q.checks.length === 0 ? (
            <Empty>Kalite kontrol kaydı yok.</Empty>
          ) : (
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
                  <tr>
                    <Th>Tarih</Th>
                    <Th>Tür</Th>
                    <Th>Lot</Th>
                    <Th>Standart</Th>
                    <Th>Sonuç</Th>
                  </tr>
                </thead>
                <tbody>
                  {q.checks.map((c) => {
                    const r = QC_RESULT[c.result] ?? { label: c.result, tone: "warn" as const };
                    return (
                      <tr key={c.id} className="border-b border-border last:border-0 even:bg-muted/30">
                        <td className="px-3 py-2">{c.checkedAt ? formatDate(c.checkedAt) : "—"}</td>
                        <td className="px-3 py-2">{QC_TYPE[c.type] ?? c.type}</td>
                        <td className="px-3 py-2">{c.lotNo ?? "—"}</td>
                        <td className="max-w-[10rem] truncate px-3 py-2">{c.standard ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", PILL[r.tone])}>{r.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <SubTitle>Uygunsuzluk raporları (NCR)</SubTitle>
          {q.ncrs.length === 0 ? (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> NCR yok.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {q.ncrs.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {n.no} <span className="text-xs font-normal text-muted-foreground">{n.createdAt ? formatDate(n.createdAt) : ""}</span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{n.description}</div>
                  </div>
                  <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-xs font-medium", n.status === "open" ? PILL.bad : PILL.ok)}>{n.status === "open" ? "Açık" : "Kapalı"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────── Gerçekleşen maliyet ───────────────────────────────

export function ActualCostSection({ insights, standard, unit }: { insights: ProductInsights; standard: number | null; unit: string }) {
  const { rows, average } = insights.actualCost;
  if (!rows.length)
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Bu ürün için tamamlanmış iş emri yok; gerçekleşen maliyet iş emri bitince oluşur.
      </p>
    );
  const diff = average !== null && standard ? average / standard - 1 : null;
  const tone: Tone = diff === null ? "neutral" : diff <= 0.02 ? "ok" : diff <= 0.1 ? "warn" : "bad";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi title="Ortalama gerçekleşen" value={average === null ? "—" : `${formatTR(average, 4)} ₺/${unit}`} hint={`${rows.length} iş emri`} tone={tone} />
        <Kpi title="Standart (reçeteden)" value={standard === null ? "—" : `${formatTR(standard, 4)} ₺/${unit}`} />
        <Kpi title="Fark" value={diff === null ? "—" : `${diff > 0 ? "+" : ""}${pct(diff, 1)}`} hint="gerçekleşen / standart − 1" tone={tone} />
      </div>
      <ActualCostChart rows={rows} standard={standard} />
      <p className="text-xs text-muted-foreground">
        Gerçekleşen = fiilen tüketilen hammadde − fire geri kazanımı + işçilik + enerji + genel gider (
        <Link href="/maliyet" className="text-primary underline-offset-2 hover:underline">
          Maliyet
        </Link>{" "}
        sayfasıyla aynı).
      </p>
    </div>
  );
}
