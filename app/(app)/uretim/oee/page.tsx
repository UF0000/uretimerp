import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleAlert, Info } from "lucide-react";

import { getOeeReport, type OeeMetrics } from "@/app/actions/oee";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatTR } from "@/lib/format";

export const metadata: Metadata = {
  title: "OEE Raporu",
  description: "Toplam ekipman etkinliği: kullanılabilirlik × performans × kalite",
};

const RANGES = [7, 30, 90] as const;

/** 0,695 → "%69,5"; veri yoksa "—" */
const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "—" : `%${formatTR(v * 100, digits)}`;

/** OEE sınıfı: ≥%85 dünya standardı, %60–85 tipik, <%60 düşük (renk + ikon + etiket) */
const oeeStatus = (oee: number | null) => {
  if (oee === null) return { label: "Veri yetersiz", icon: Info, className: "text-muted-foreground" };
  if (oee >= 0.85) return { label: "Dünya standardı", icon: CheckCircle2, className: "text-success" };
  if (oee >= 0.6) return { label: "Tipik seviye", icon: AlertTriangle, className: "text-warning" };
  return { label: "Düşük", icon: CircleAlert, className: "text-danger" };
};

const StatTile = ({ title, value, hint }: { title: string; value: string; hint: string }) => (
  <Card>
    <CardContent className="space-y-1 pt-6">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </CardContent>
  </Card>
);

const ParetoList = ({
  title,
  rows,
  unit,
  empty,
}: {
  title: string;
  rows: { id: string; code: string; label: string; value: number; share: number; cumulativeShare: number }[];
  unit: string;
  empty: string;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="space-y-3">
          {rows.slice(0, 8).map((r) => (
            <li key={r.id} className="space-y-1" title={`${r.code} ${r.label}: ${formatTR(r.value, 1)} ${unit} (${pct(r.share)})`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">
                  <span className="font-medium">{r.code}</span>{" "}
                  <span className="text-muted-foreground">{r.label}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatTR(r.value, 1)} {unit}{" "}
                  <span className="text-xs text-muted-foreground">({pct(r.share, 0)})</span>
                </span>
              </div>
              <progress
                value={r.share * 100}
                max={100}
                aria-label={`${r.code} payı`}
                className="h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary"
              />
            </li>
          ))}
        </ol>
      )}
      {rows.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          İlk {Math.min(3, rows.length)} neden toplamın {pct(rows[Math.min(3, rows.length) - 1].cumulativeShare, 0)} kadarını oluşturuyor.
        </p>
      )}
    </CardContent>
  </Card>
);

const MetricCells = ({ m }: { m: OeeMetrics }) => {
  const status = oeeStatus(m.oee);
  const Icon = status.icon;
  return (
    <>
      <td className="px-3 py-2 text-right tabular-nums">{pct(m.availability)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{pct(m.performance)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{pct(m.quality)}</td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums">{pct(m.oee)}</td>
      <td className="px-3 py-2">
        <span className={cn("inline-flex items-center gap-1 text-xs", status.className)}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
          <span className="text-foreground">{status.label}</span>
        </span>
      </td>
    </>
  );
};

export default async function OeePage(props: { searchParams: Promise<{ gun?: string }> }) {
  const { gun } = await props.searchParams;
  const days = RANGES.find((r) => String(r) === gun) ?? 30;
  const report = await getOeeReport(days);
  const t = report.total;
  const status = oeeStatus(t.oee);
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        title="OEE Raporu"
        description={`Toplam ekipman etkinliği — vardiya süresi ${formatTR(report.shiftMinutes, 0)} dk kabul edilir`}
      />

      {/* Dönem filtresi: grafiklerin üstünde tek satır */}
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/uretim/oee?gun=${r}`}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              r === days ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent",
            )}
            aria-current={r === days ? "page" : undefined}
          >
            Son {r} gün
          </Link>
        ))}
        <span className="text-sm text-muted-foreground">
          {t.entries} vardiya girişi · {formatTR(t.downtimeMin, 0)} dk duruş · {formatTR(t.scrapKg, 1)} kg fire
        </span>
      </div>

      {t.entries === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Bu dönemde vardiya girişi yok. OEE, İş Emirleri sayfasından yapılan vardiya girişlerinden hesaplanır.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="space-y-1 pt-6">
                <div className="text-sm text-muted-foreground">OEE</div>
                <div className="text-3xl font-semibold tabular-nums">{pct(t.oee)}</div>
                <div className={cn("flex items-center gap-1 text-xs", status.className)}>
                  <StatusIcon className="h-3.5 w-3.5" aria-hidden />
                  <span className="text-foreground">{status.label}</span>
                </div>
              </CardContent>
            </Card>
            <StatTile title="Kullanılabilirlik" value={pct(t.availability)} hint="(Planlı süre − duruş) / planlı süre" />
            <StatTile
              title="Performans"
              value={pct(t.performance)}
              hint={`İdeal süre / çalışma süresi · girişlerin ${pct(t.performanceCoverage, 0)} kadarında ideal veri var`}
            />
            <StatTile title="Kalite" value={pct(t.quality)} hint="Sağlam kütle / harcanan hammadde" />
          </div>

          {t.performance !== null && t.performance > 1.05 && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              Performans %100&apos;ü aşıyor: bir vardiyada ideal hızdan fazla üretim girilmiş görünüyor. Vardiya süresi,
              reçetedeki çevrim süresi/hedef hız veya girilen miktarlar hatalı olabilir. OEE hesabında performans %100 ile
              sınırlandı.
            </p>
          )}

          {t.performanceCoverage < 1 && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Bazı girişlerde performans hesaplanamadı: enjeksiyonda reçetede çevrim süresi, ekstrüzyonda reçetede
              hedef hız (m/saat) tanımlı olmalı. OEE bu girişlerde hesaplanan performansla tahmin edilir.
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Makine Bazında (düşükten yükseğe)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 font-medium">Hat / Kalıp</th>
                    <th className="px-3 py-2 text-right font-medium">Vardiya</th>
                    <th className="px-3 py-2 text-right font-medium">Duruş</th>
                    <th className="px-3 py-2 text-right font-medium">Kullanılabilirlik</th>
                    <th className="px-3 py-2 text-right font-medium">Performans</th>
                    <th className="px-3 py-2 text-right font-medium">Kalite</th>
                    <th className="px-3 py-2 text-right font-medium">OEE</th>
                    <th className="px-3 py-2 font-medium">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {report.machines.map((m) => (
                    <tr key={m.label} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{m.label}</div>
                        <div className="text-xs text-muted-foreground">{m.kind}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.entries}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatTR(m.downtimeMin, 0)} dk</td>
                      <MetricCells m={m} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <ParetoList title="Duruş Nedenleri (dk)" rows={report.downtimePareto} unit="dk" empty="Bu dönemde duruş kaydı yok." />
            <ParetoList title="Fire Nedenleri (kg)" rows={report.scrapPareto} unit="kg" empty="Bu dönemde fire kaydı yok." />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Günlük</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 font-medium">Gün</th>
                    <th className="px-3 py-2 text-right font-medium">Vardiya</th>
                    <th className="px-3 py-2 text-right font-medium">Kullanılabilirlik</th>
                    <th className="px-3 py-2 text-right font-medium">Performans</th>
                    <th className="px-3 py-2 text-right font-medium">Kalite</th>
                    <th className="px-3 py-2 text-right font-medium">OEE</th>
                    <th className="px-3 py-2 font-medium">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {report.daily.map((d) => (
                    <tr key={d.day} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 tabular-nums">{d.day.split("-").reverse().join(".")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.entries}</td>
                      <MetricCells m={d} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
