import type { Metadata } from "next";
import { Suspense } from "react";

import { getScrapReport } from "@/app/actions/scrap";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTR } from "@/lib/format";
import type { ScrapReport } from "@/lib/scrap-report";
import { cn } from "@/lib/utils";
import { ScrapFilters } from "./components/scrap-filters";
import { ScrapParetoChart, ScrapTrendChart } from "./components/scrap-charts";

export const metadata: Metadata = {
  title: "Fire Raporu",
  description: "Fire oranı, nedenleri, makine/ürün/vardiya/operatör kırılımı ve geri kazanım",
};

export const dynamic = "force-dynamic";

type SearchParams = { bas?: string; bit?: string; tur?: string; hat?: string };

const isDate = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
const pct = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? "—" : `%${formatTR(v * 100, d)}`);
const kg = (v: number, d = 0) => `${formatTR(v, d)} kg`;

type Row = ScrapReport["byLine"][number];

const Kpi = ({ title, value, hint, tone }: { title: string; value: string; hint?: string; tone?: "danger" | "success" | "warning" }) => (
  <Card className="break-inside-avoid">
    <CardContent className="space-y-1 pt-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className={cn("text-2xl font-semibold tabular-nums", tone === "danger" && "text-danger", tone === "success" && "text-success", tone === "warning" && "text-warning")}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </CardContent>
  </Card>
);

const BreakdownTable = ({ title, rows, limit = 15 }: { title: string; rows: Row[]; limit?: number }) => (
  <Card className="break-inside-avoid">
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent className="overflow-x-auto">
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Kayıt yok.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-2 py-2 font-medium" />
              <th className="px-2 py-2 text-right font-medium">Tüketim</th>
              <th className="px-2 py-2 text-right font-medium">Fire</th>
              <th className="px-2 py-2 text-right font-medium">Fire %</th>
              <th className="px-2 py-2 text-right font-medium">Pay</th>
              <th className="px-2 py-2 font-medium">En sık neden</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((r) => (
              <tr key={r.key} className="border-b border-border last:border-0">
                <td className="max-w-[16rem] truncate px-2 py-2 font-medium" title={r.label}>
                  {r.label}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{formatTR(r.usedKg, 0)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatTR(r.scrapKg, 1)}</td>
                <td className={cn("px-2 py-2 text-right tabular-nums", r.overTarget ? "text-danger" : "text-success")}>{pct(r.scrapPct, 2)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{pct(r.share, 0)}</td>
                <td className="max-w-[12rem] truncate px-2 py-2 text-xs text-muted-foreground" title={r.topReason ?? ""}>
                  {r.topReason ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > limit && <p className="pt-2 text-xs text-muted-foreground">+{rows.length - limit} satır daha (Excel çıktısında tamamı var)</p>}
    </CardContent>
  </Card>
);

const sheetRows = (rows: Row[], keyLabel: string) =>
  rows.map((r) => ({
    [keyLabel]: r.label,
    "Tüketim (kg)": r.usedKg,
    "Fire (kg)": r.scrapKg,
    "Fire (%)": r.scrapPct === null ? null : r.scrapPct * 100,
    "Regrind (kg)": r.regrindKg,
    "Kayıp (kg)": r.lostKg,
    "Pay (%)": r.share * 100,
    "En sık neden": r.topReason,
  }));

export default async function ScrapReportPage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  const from = isDate(sp.bas) ? sp.bas! : `${today.slice(0, 4)}-01-01`;
  const to = isDate(sp.bit) ? sp.bit! : today;
  const lineType = sp.tur === "ekstruzyon" ? "extrusion" : sp.tur === "enjeksiyon" ? "injection" : undefined;

  const { report: r, lineOptions, days } = await getScrapReport({ from, to, lineType, lineId: sp.hat || undefined });
  const t = r.total;
  const over = t.scrapPct !== null && t.scrapPct * 100 > r.targetScrapPct;

  const exportSheets = [
    {
      name: "Özet",
      rows: [
        { Gösterge: "Tüketim (kg)", Değer: t.usedKg },
        { Gösterge: "Fire (kg)", Değer: t.scrapKg },
        { Gösterge: "Fire (%)", Değer: t.scrapPct === null ? null : t.scrapPct * 100 },
        { Gösterge: "Hedef (%)", Değer: r.targetScrapPct },
        { Gösterge: "Regrind'e ayrılan (kg)", Değer: t.regrindKg },
        { Gösterge: "Kayıp / hurda (kg)", Değer: t.lostKg },
        { Gösterge: "Nedeni girilmemiş (kg)", Değer: t.unexplainedKg },
      ],
    },
    { name: "Nedenler", rows: r.pareto.map((p) => ({ Kod: p.code, Neden: p.label, "Fire (kg)": p.kg, "Pay (%)": p.share * 100, "Kümülatif (%)": p.cumulative * 100 })) },
    { name: r.bucket === "week" ? "Haftalık" : "Günlük", rows: r.trend.map((x) => ({ Dönem: x.period, "Fire (kg)": x.scrapKg, "Fire (%)": x.scrapPct })) },
    { name: "Makine", rows: sheetRows(r.byLine, "Makine") },
    { name: "Ürün", rows: sheetRows(r.byProduct, "Ürün") },
    { name: "Vardiya", rows: sheetRows(r.byShift, "Vardiya") },
    { name: "Operatör", rows: sheetRows(r.byOperator, "Operatör") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fire Raporu"
        description={`${from.split("-").reverse().join(".")} – ${to.split("-").reverse().join(".")} (${days} gün) · ${t.entries} vardiya girişi, ${t.entriesWithScrap} tanesinde fire`}
      />

      <Suspense>
        <ScrapFilters from={from} to={to} lineOptions={lineOptions} exportSheets={exportSheets} />
      </Suspense>

      {t.entries === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Bu filtrelerle vardiya girişi yok.</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi title="Fire" value={kg(t.scrapKg)} hint={`${kg(t.usedKg)} tüketimden`} />
            <Kpi title="Fire oranı" value={pct(t.scrapPct, 2)} tone={over ? "danger" : "success"} hint={`hedef ≤ %${formatTR(r.targetScrapPct, 1)}`} />
            <Kpi title="Regrind'e ayrılan" value={kg(t.regrindKg)} hint={`geri kazanım ${pct(t.recoveryPct, 0)}`} tone="success" />
            <Kpi title="Kayıp (hurda)" value={kg(t.lostKg)} hint="regrind'e dönmeyen fire" />
            <Kpi title="Nedeni girilmemiş" value={kg(t.unexplainedKg)} tone={t.unexplainedKg > 0 ? "warning" : undefined} hint="neden kodu olmayan fire" />
            <Kpi title="Fire'nin %80'i" value={`${r.vitalFew} neden`} hint={`${r.pareto.length} nedenden`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="break-inside-avoid">
              <CardHeader>
                <CardTitle className="text-base">{r.bucket === "week" ? "Haftalık" : "Günlük"} fire trendi</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrapTrendChart data={r.trend} target={r.targetScrapPct} bucket={r.bucket} />
              </CardContent>
            </Card>
            <Card className="break-inside-avoid">
              <CardHeader>
                <CardTitle className="text-base">Neden Pareto&apos;su</CardTitle>
              </CardHeader>
              <CardContent>
                {r.pareto.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nedeni girilmiş fire yok.</p> : <ScrapParetoChart data={r.pareto} />}
              </CardContent>
            </Card>
          </div>

          <Card className="break-inside-avoid">
            <CardHeader>
              <CardTitle className="text-base">Fire nedenleri</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-2 py-2 font-medium">Kod</th>
                    <th className="px-2 py-2 font-medium">Neden</th>
                    <th className="px-2 py-2 text-right font-medium">Fire</th>
                    <th className="px-2 py-2 text-right font-medium">Pay</th>
                    <th className="px-2 py-2 text-right font-medium">Kümülatif</th>
                  </tr>
                </thead>
                <tbody>
                  {r.pareto.map((p, i) => (
                    <tr key={p.id} className={cn("border-b border-border last:border-0", i < r.vitalFew && "font-medium")}>
                      <td className="px-2 py-2">{p.code}</td>
                      <td className="px-2 py-2">{p.label}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{kg(p.kg, 1)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{pct(p.share, 1)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{pct(p.cumulative, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.vitalFew > 0 && <p className="pt-2 text-xs text-muted-foreground">Kalın satırlar fire&apos;nin %80&apos;ini oluşturan nedenler; önce bunlara odaklanın.</p>}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <BreakdownTable title="Makine bazında" rows={r.byLine} />
            <BreakdownTable title={lineType ? "Vardiya bazında" : "Vardiya ve üretim türü"} rows={lineType ? r.byShift : [...r.byShift, ...r.byType]} />
            <BreakdownTable title="Ürün bazında (en çok fire)" rows={r.byProduct} />
            <BreakdownTable title="Operatör bazında" rows={r.byOperator} />
          </div>

          <p className="text-xs text-muted-foreground">
            Fire % = fire kg / hammadde tüketimi. Regrind&apos;e ayrılan: vardiya girişinde regrind ürününe yönlendirilen fire; kayıp = fire −
            regrind. Hedef Yönetim → Parametreler&apos;den değiştirilir.
          </p>
        </>
      )}
    </div>
  );
}
