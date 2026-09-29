import type { Metadata } from "next";
import { AlertTriangle, Info } from "lucide-react";

import { getProductionAnalytics } from "@/app/actions/analytics";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AnalyticsFilters, TypeToggle } from "./components/analytics-filters";
import { ActualVsExpected, DistributionDonut, ShiftComparison, StatusBars, TrendChart } from "./components/analytics-charts";
import { STATUS_LABELS, type Status } from "@/lib/analytics-status";

export const metadata: Metadata = {
  title: "Üretim Analizi",
  description: "Boru (ekstrüzyon) ve enjeksiyon üretim takip panosu: üretim, fire, duruş, overweight, kapasite ve OEE",
};

export const dynamic = "force-dynamic";

type SearchParams = { bas?: string; bit?: string; tur?: string; hat?: string; vardiya?: string; urun?: string; ie?: string; hammadde?: string };

const isDate = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
const pct = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? "—" : `%${formatTR(v * 100, d)}`);
const kg = (v: number, d = 0) => `${formatTR(v, d)} kg`;

/** Hedefe göre durum (küçük iyi): hedefte ≤ hedef, sınırda ≤ hedef × 1,2, üstü hedef dışı. */
const statusOf = (valuePct: number | null, targetPct: number): Status | undefined => {
  if (valuePct === null) return undefined;
  if (valuePct <= targetPct) return "ok";
  return valuePct <= targetPct * 1.2 ? "warn" : "bad";
};
/** Büyük iyi (OEE): hedefte ≥ hedef, sınırda ≥ hedef × 0,85. */
const statusHigh = (valuePct: number | null, targetPct: number): Status | undefined => {
  if (valuePct === null) return undefined;
  if (valuePct >= targetPct) return "ok";
  return valuePct >= targetPct * 0.85 ? "warn" : "bad";
};

const STATUS_TEXT: Record<Status, string> = { ok: "text-success", warn: "text-warning", bad: "text-danger" };
const STATUS_BORDER: Record<Status, string> = { ok: "border-l-success", warn: "border-l-warning", bad: "border-l-danger" };
const STATUS_PILL: Record<Status, string> = {
  ok: "bg-success/15 text-success",
  warn: "bg-warning/20 text-warning-foreground",
  bad: "bg-danger/15 text-danger",
};

const Kpi = ({ title, value, hint, status, accent }: { title: string; value: string; hint?: string; status?: Status; accent?: string }) => (
  <Card className={cn("break-inside-avoid border-l-4", status ? STATUS_BORDER[status] : (accent ?? "border-l-border"))}>
    <CardContent className="space-y-1 pt-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className={cn("text-2xl font-semibold tabular-nums", status && STATUS_TEXT[status])}>{value}</div>
      {(hint || status) && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {status && status !== "ok" && <AlertTriangle className={cn("h-3.5 w-3.5", STATUS_TEXT[status])} aria-hidden />}
          {status && <span className={cn("font-medium", STATUS_TEXT[status])}>{STATUS_LABELS[status]}</span>}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </CardContent>
  </Card>
);

/** Durum renkli yüzde hücresi */
const Pill = ({ value, status, d = 2 }: { value: number | null; status?: Status; d?: number }) =>
  value === null ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className={cn("inline-block rounded px-1.5 py-0.5 font-medium tabular-nums", status ? STATUS_PILL[status] : "")}>{pct(value, d)}</span>
  );

const Section = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    {children}
  </section>
);

const ChartCard = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => (
  <Card className={cn("break-inside-avoid", className)}>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("whitespace-nowrap px-3 py-2 font-medium", right && "text-right")}>{children}</th>
);

export default async function ProductionAnalyticsPage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  // Bugün Türkiye saatine göre (UTC gece yarısından sonraki gece vardiyası girişleri kaçmasın)
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  const from = isDate(sp.bas) ? sp.bas! : `${today.slice(0, 4)}-01-01`;
  const to = isDate(sp.bit) ? sp.bit! : today;
  const lineType = sp.tur === "fitting" || sp.tur === "enjeksiyon" ? "injection" : "extrusion";

  // Fitting (enjeksiyon) panosu henüz tasarlanmadı: şimdilik boş sayfa
  if (lineType === "injection") {
    return (
      <div className="space-y-8">
        <PageHeader title="Üretim Analizi — Fitting" description="Enjeksiyon üretim panosu" />
        <div className="print:hidden">
          <TypeToggle from={from} to={to} lineType={lineType} />
        </div>
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">Fitting panosu hazırlanıyor.</CardContent>
        </Card>
      </div>
    );
  }

  const { options, analytics: a, days } = await getProductionAnalytics({
    from,
    to,
    lineType,
    lineId: sp.hat || undefined,
    shift: sp.vardiya === "day" || sp.vardiya === "night" ? sp.vardiya : undefined,
    productId: sp.urun || undefined,
    workOrderId: sp.ie || undefined,
    rawMaterialId: sp.hammadde || undefined,
  });
  const t = a.total;
  const tg = a.targets;
  const isExtrusion = lineType === "extrusion";
  const families = [...new Set(a.shifts.flatMap((s) => Object.keys(s.materialsKg)))];
  const shiftName = { day: "GÜNDÜZ", night: "GECE" } as const;
  const lineCount = a.capacity.linesWithCapacity + a.capacity.linesWithoutCapacity;
  const scrapStatus = (v: number | null) => statusOf(v === null ? null : v * 100, tg.scrapPct);
  const oeeStatus = (v: number | null) => statusHigh(v === null ? null : v * 100, tg.oeePct);
  const owStatus = (v: number | null) => statusOf(v === null ? null : Math.abs(v * 100), tg.overweightTolerancePct);

  const breakdownSheet = (rows: typeof a.byLine, keyLabel: string) =>
    rows.map((r) => ({
      [keyLabel]: r.label,
      "Tüketim (kg)": r.usedKg,
      "Sağlam (kg)": r.goodKg,
      "Fire (kg)": r.scrapKg,
      "Fire (%)": r.scrapPct === null ? null : r.scrapPct * 100,
      "OEE (%)": r.oee === null ? null : r.oee * 100,
      "Duruş (dk)": r.downtimeMin,
      "En sık fire nedeni": r.topScrapReason,
      "En sık duruş nedeni": r.topDowntimeReason,
    }));

  const exportSheets = [
    {
      name: "Özet",
      rows: [
        { Gösterge: "Sağlam (kg)", Değer: t.goodKg },
        { Gösterge: "Tüketim (kg)", Değer: t.usedKg },
        { Gösterge: isExtrusion ? "Üretim (m)" : "Üretim (adet)", Değer: isExtrusion ? t.producedM : t.producedPcs },
        { Gösterge: "Fire (kg)", Değer: t.scrapKg },
        { Gösterge: "Fire (%)", Değer: t.scrapPct === null ? null : t.scrapPct * 100 },
        { Gösterge: "Regrind'e ayrılan (kg)", Değer: a.scrapRecovery.regrindKg },
        { Gösterge: "Kayıp / hurda (kg)", Değer: a.scrapRecovery.lostKg },
        { Gösterge: "Overweight (%)", Değer: t.overweightPct === null ? null : t.overweightPct * 100 },
        { Gösterge: "OEE (%)", Değer: t.oee === null ? null : t.oee * 100 },
        { Gösterge: "Materyal verim (%)", Değer: t.materialYield === null ? null : t.materialYield * 100 },
        { Gösterge: "NŞA kapasite (kg)", Değer: a.capacity.nsaCapacityKg },
        { Gösterge: "Kapasite verimi (%)", Değer: a.capacity.capacityEfficiency === null ? null : a.capacity.capacityEfficiency * 100 },
        { Gösterge: "Zaman kullanımı (%)", Değer: a.capacity.timeUtilization === null ? null : a.capacity.timeUtilization * 100 },
        { Gösterge: "Referansa göre hız (%)", Değer: t.speedPerformance === null ? null : t.speedPerformance * 100 },
        { Gösterge: "Çalışma (saat)", Değer: t.runHours },
        { Gösterge: "Duruş (saat)", Değer: t.downtimeHours },
      ],
    },
    { name: a.trendBucket === "week" ? "Haftalık trend" : "Günlük trend", rows: a.trend.map((x) => ({ Dönem: x.period, "Tüketim (kg)": x.usedKg, "Fire (kg)": x.scrapKg, "Fire (%)": x.scrapPct, "OEE (%)": x.oeePct, "Duruş (dk)": x.downtimeMin })) },
    { name: "Makine", rows: breakdownSheet(a.byLine, "Makine") },
    { name: "Operatör", rows: breakdownSheet(a.byOperator, "Operatör") },
    {
      name: "Hammadde",
      rows: a.rawMaterials.map((m) => ({
        Hammadde: m.name,
        "Tüketim (kg)": m.usedKg,
        "Sağlam çıktı (kg)": m.goodKg,
        "Verim (%)": m.yieldPct === null ? null : m.yieldPct * 100,
        "Fire (kg)": m.scrapKg,
        "Geri dön. (kg)": m.regrindKg,
        "Kayıp (kg)": m.lostKg,
        "Fire (%)": m.scrapPct === null ? null : m.scrapPct * 100,
        "Üretim emri": m.workOrders,
      })),
    },
    {
      name: "İş emirleri",
      rows: a.workOrders.map((w) => ({
        "Üretim emri": w.workOrderNo,
        Ürün: `${w.productCode} ${w.productName}`,
        Reçete: w.bomCode,
        "Tüketim (kg)": w.usedKg,
        "Sağlam (kg)": w.goodKg,
        "Verim (%)": w.materialYield === null ? null : w.materialYield * 100,
        "Fire (%)": w.scrapPct === null ? null : w.scrapPct * 100,
        "Overweight (%)": w.overweightPct === null ? null : w.overweightPct * 100,
        "OEE (%)": w.oee === null ? null : w.oee * 100,
        "Referansa göre hız (%)": w.speedPerformance === null ? null : w.speedPerformance * 100,
        "Hedef dışı": w.outOfTarget ? "Evet" : "Hayır",
      })),
    },
    { name: "Fire nedenleri", rows: a.scrapReasons.map((r) => ({ Kod: r.code, Neden: r.label, "Fire (kg)": r.value, "Pay (%)": r.share * 100 })) },
    { name: "Duruş nedenleri", rows: a.downtimeReasons.map((r) => ({ Kod: r.code, Neden: r.label, "Duruş (dk)": r.value, "Pay (%)": r.share * 100 })) },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={isExtrusion ? "Üretim Analizi — Boru" : "Üretim Analizi — Fitting"}
        description={`${from.split("-").reverse().join(".")} – ${to.split("-").reverse().join(".")} (${days} gün) · ${a.workOrders.length} iş emri · ${t.entries} vardiya girişi`}
      />

      <AnalyticsFilters from={from} to={to} lineType={lineType} options={options} exportSheets={exportSheets} />

      {t.entries === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Bu filtrelerle vardiya girişi yok. Tarih aralığını genişletin veya filtreleri temizleyin.
          </CardContent>
        </Card>
      ) : (
        <>
          <Section title="Üretim ve kalite özeti" description="Hedeflere göre renkli: yeşil hedefte, turuncu sınırda, kırmızı hedef dışı">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
              <Kpi title="Sağlam (kg)" value={formatTR(t.goodKg, 0)} accent="border-l-[var(--cat-1)]" />
              <Kpi title="Tüketim (kg)" value={formatTR(t.usedKg, 0)} accent="border-l-[var(--cat-1)]" />
              <Kpi title={isExtrusion ? "Üretim (m)" : "Üretim (adet)"} value={formatTR(isExtrusion ? t.producedM : t.producedPcs, 0)} accent="border-l-[var(--cat-2)]" />
              <Kpi title="Fire (kg)" value={formatTR(t.scrapKg, 0)} hint={`${formatTR(a.scrapRecovery.regrindKg, 0)} kg regrind · ${formatTR(a.scrapRecovery.lostKg, 0)} kg kayıp`} accent="border-l-[var(--cat-3)]" />
              <Kpi title="Ort. fire" value={pct(t.scrapPct, 2)} status={scrapStatus(t.scrapPct)} hint={`hedef ≤ %${formatTR(tg.scrapPct, 1)}`} />
              <Kpi
                title="Ort. overweight"
                value={pct(t.overweightPct, 2)}
                status={owStatus(t.overweightPct)}
                hint={t.overweightPct === null ? "reçetede birim ağırlık yok" : `tolerans ±%${formatTR(tg.overweightTolerancePct, 1)}`}
              />
              <Kpi title="OEE" value={pct(t.oee, 1)} status={oeeStatus(t.oee)} hint={`çalışma / vardiya süresi · hedef ≥ %${formatTR(tg.oeePct, 0)}`} />
              <Kpi title="Duruş oranı" value={pct(t.availability === null ? null : 1 - t.availability, 1)} hint="duruş / vardiya süresi" accent="border-l-[var(--cat-5)]" />
              <Kpi title="Materyal verim" value={pct(t.materialYield, 1)} hint="sağlam / tüketim" accent="border-l-[var(--cat-6)]" />
              <Kpi title="Çalışma / duruş" value={`${formatTR(t.runHours, 0)} / ${formatTR(t.downtimeHours, 0)} sa`} accent="border-l-[var(--cat-5)]" />
            </div>
          </Section>

          <Section title="Kapasite ve süre özeti" description="Makine kapasitesi ve çalışma takvimine göre verim, zaman kullanımı ve beklenen üretim">
            {a.capacity.linesWithCapacity === 0 ? (
              <p className="flex items-start gap-2 rounded-md border border-border p-3 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Bu dönemde geçerli makine kapasitesi (kg/saat) yok. Yönetim → Makine Kapasitesi&apos;nden her makinenin kapasitesini
                girin; kapasite verimi, zaman kullanımı ve beklenen üretim buna göre hesaplanır.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
                <Kpi title="Makine-saat ağırlıklı kapasite" value={a.capacity.weightedCapacityKgPerHour === null ? "—" : `${formatTR(a.capacity.weightedCapacityKgPerHour, 1)} kg/sa`} accent="border-l-[var(--cat-4)]" />
                <Kpi title="Makine bazlı NŞA kapasite" value={kg(a.capacity.nsaCapacityKg)} hint={`${a.capacity.linesWithCapacity} makine × ${formatTR(lineCount ? a.capacity.availableLineHours / lineCount : 0, 0)} kullanılabilir saat`} accent="border-l-[var(--cat-4)]" />
                <Kpi title="Kapasite verimi" value={pct(a.capacity.capacityEfficiency)} hint="tüketim / NŞA kapasite" accent="border-l-[var(--cat-4)]" />
                <Kpi title="Aktif sürede kapasite" value={pct(a.capacity.activeCapacityPct)} hint="çalışılan sürede" accent="border-l-[var(--cat-4)]" />
                <Kpi title="Zaman kullanımı" value={pct(a.capacity.timeUtilization)} hint="çalışma / kullanılabilir süre" accent="border-l-[var(--cat-4)]" />
                <Kpi title="Hız performansı" value={pct(t.performance)} hint="ideal / gerçek çalışma süresi" accent="border-l-[var(--cat-6)]" />
                <Kpi
                  title="Referansa göre hız"
                  value={pct(t.speedPerformance)}
                  hint={t.speedPerformance === null ? "referans kapasite yok (Yönetim)" : `girişlerin ${pct(t.referenceCoverage, 0)}'inde referans var`}
                  accent="border-l-[var(--cat-6)]"
                />
                <Kpi title="Referansa göre beklenen" value={kg(t.referenceExpectedKg)} hint="referans × çalışma saati" accent="border-l-[var(--cat-6)]" />
                <Kpi title="Fiili sürede beklenen" value={kg(a.capacity.expectedKg)} hint="kapasite × çalışma saati" accent="border-l-[var(--cat-4)]" />
                <Kpi title="Kayıp (hurda) fire" value={kg(a.scrapRecovery.lostKg)} hint={`geri kazanım ${pct(a.scrapRecovery.recoveryPct, 0)}`} accent="border-l-[var(--cat-3)]" />
              </div>
            )}
            {a.capacity.linesWithoutCapacity > 0 && a.capacity.linesWithCapacity > 0 && (
              <p className="text-xs text-muted-foreground">{a.capacity.linesWithoutCapacity} makinede kapasite girilmemiş; hesaba katılmadı.</p>
            )}
          </Section>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Hammadde Tüketimi Dağılımı (KG)">
              <DistributionDonut data={a.rawMaterials.map((m) => ({ name: m.name, value: m.usedKg }))} unit="kg" colorBy="family" empty="Tüketim kaydı yok." />
            </ChartCard>
            <ChartCard title="Fire Nedenleri Dağılımı (KG)">
              <DistributionDonut data={a.scrapReasons.map((r) => ({ name: r.label, value: r.value }))} unit="kg" empty="Nedeni girilmiş fire yok." />
            </ChartCard>
            <ChartCard title="Duruş Nedenleri Dağılımı (DK)">
              <DistributionDonut data={a.downtimeReasons.map((r) => ({ name: r.label, value: r.value }))} unit="dk" empty="Duruş kaydı yok." />
            </ChartCard>
          </div>

          <ChartCard title="Vardiya Karşılaştırması">
            <ShiftComparison
              qtyUnit={isExtrusion ? "Metre" : "Adet"}
              families={families}
              data={a.shifts.map((s) => ({
                name: shiftName[s.shift],
                kg: s.goodKg,
                qty: isExtrusion ? s.producedM : s.producedPcs,
                scrapPct: (s.scrapPct ?? 0) * 100,
                oeePct: (s.oee ?? 0) * 100,
                downtimeMin: s.downtimeHours * 60,
                materials: s.materialsKg,
              }))}
            />
          </ChartCard>

          <ChartCard title={`${a.trendBucket === "week" ? "Haftalık" : "Günlük"} Fire ve OEE Trendi (%)`}>
            <TrendChart data={a.trend} bucket={a.trendBucket} scrapTarget={tg.scrapPct} oeeTarget={tg.oeePct} />
          </ChartCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Üretim Emri Bazlı Fire (%)">
              <StatusBars
                rows={a.workOrders
                  .filter((w) => w.scrapPct !== null)
                  .map((w) => ({ label: w.workOrderNo, sublabel: w.productCode, value: w.scrapPct! * 100, status: scrapStatus(w.scrapPct) ?? "ok" }))}
                references={[{ value: tg.scrapPct, label: `hedef %${formatTR(tg.scrapPct, 1)}` }]}
              />
            </ChartCard>
            <ChartCard title="Üretim Emri Bazlı Overweight (%)">
              <StatusBars
                diverging
                rows={a.workOrders
                  .filter((w) => w.overweightPct !== null)
                  .map((w) => ({ label: w.workOrderNo, sublabel: w.productCode, value: w.overweightPct! * 100, status: owStatus(w.overweightPct) ?? "ok" }))}
                references={[
                  { value: -tg.overweightTolerancePct, label: `−%${formatTR(tg.overweightTolerancePct, 1)}` },
                  { value: tg.overweightTolerancePct, label: `+%${formatTR(tg.overweightTolerancePct, 1)}` },
                ]}
              />
            </ChartCard>
            <ChartCard title="Gerçek Tüketim vs Kapasiteye Göre Beklenen (kg)" className="xl:col-span-2">
              <ActualVsExpected
                rows={a.workOrders
                  .filter((w) => w.expectedKg > 0)
                  .sort((x, y) => y.expectedKg - x.expectedKg)
                  .map((w) => ({ label: w.workOrderNo, actual: w.usedKg, expected: w.expectedKg }))}
              />
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {(
              [
                ["Makine Bazında Fire, OEE ve Duruş", a.byLine],
                ["Operatör Bazında Fire, OEE ve Duruş", a.byOperator],
              ] as const
            ).map(([title, rows]) => (
              <ChartCard key={title} title={title}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left text-muted-foreground">
                      <tr>
                        <Th>{title.startsWith("Makine") ? "Makine" : "Operatör"}</Th>
                        <Th right>Tüketim (kg)</Th>
                        <Th right>Fire</Th>
                        <Th right>OEE</Th>
                        <Th right>Duruş (sa)</Th>
                        <Th>En sık fire nedeni</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 15).map((r) => (
                        <tr key={r.key} className="border-b border-border last:border-0 even:bg-muted/30">
                          <td className="max-w-[12rem] truncate px-3 py-2 font-medium" title={r.label}>
                            {r.label}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatTR(r.usedKg, 0)}</td>
                          <td className="px-3 py-2 text-right">
                            <Pill value={r.scrapPct} status={scrapStatus(r.scrapPct)} />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Pill value={r.oee} status={oeeStatus(r.oee)} d={1} />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatTR(r.downtimeMin / 60, 1)}</td>
                          <td className="max-w-[12rem] truncate px-3 py-2 text-xs text-muted-foreground" title={r.topScrapReason ?? ""}>
                            {r.topScrapReason ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 15 && <p className="pt-2 text-xs text-muted-foreground">+{rows.length - 15} satır daha (Excel çıktısında tamamı var)</p>}
                </div>
              </ChartCard>
            ))}
          </div>

          <Section
            title="Kontrol öncelikleri"
            description={`Hedef dışı iş emirleri, en büyük sapma önce · fire ≤ %${formatTR(tg.scrapPct, 1)} · overweight ±%${formatTR(tg.overweightTolerancePct, 1)}`}
          >
            <Card className={cn("border-l-4", a.outOfTargetCount > 0 ? "border-l-danger" : "border-l-success")}>
              <CardContent className="space-y-3 pt-5">
                <p className="text-sm">
                  <span className={cn("text-2xl font-semibold tabular-nums", a.outOfTargetCount > 0 ? "text-danger" : "text-success")}>{a.outOfTargetCount}</span>
                  <span className="text-muted-foreground"> / {a.workOrders.length} iş emri hedef dışında</span>
                </p>
                {a.priorities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tüm iş emirleri hedef içinde.</p>
                ) : (
                  <ol className="divide-y divide-border">
                    {a.priorities.slice(0, 10).map((w, i) => (
                      <li key={w.workOrderId} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
                        <div>
                          <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                          <span className="font-semibold">{w.workOrderNo}</span>
                          <span className="ml-2 text-muted-foreground">
                            {w.productCode} {w.productName}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {w.scrapDeviation !== null && w.scrapDeviation > 0 && (
                            <span className={cn("rounded px-1.5 py-0.5", STATUS_PILL.bad)}>
                              Fire {pct(w.scrapPct, 2)} · hedefin +{formatTR(w.scrapDeviation, 2)} puan üstü
                            </span>
                          )}
                          {w.overweightDeviation !== null && w.overweightDeviation > 0 && (
                            <span className={cn("rounded px-1.5 py-0.5", STATUS_PILL.bad)}>
                              Overweight {pct(w.overweightPct, 2)} · toleransın {formatTR(w.overweightDeviation, 2)} puan dışı
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </Section>

          <Section title="Özet tablolar">
            <ChartCard title="Hammadde Özeti">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-muted-foreground">
                    <tr>
                      <Th>Hammadde</Th>
                      <Th right>Tüketim (kg)</Th>
                      <Th right>Sağlam çıktı (kg)</Th>
                      <Th right>Verim</Th>
                      <Th right>Fire (kg)</Th>
                      <Th right>Geri dön. (kg)</Th>
                      <Th right>Kayıp (kg)</Th>
                      <Th right>Fire</Th>
                      <Th right>Üretim emri</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.rawMaterials.map((m) => (
                      <tr key={m.productId} className="border-b border-border last:border-0 even:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{m.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTR(m.usedKg, 0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTR(m.goodKg, 0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{pct(m.yieldPct, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTR(m.scrapKg, 0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTR(m.regrindKg, 0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTR(m.lostKg, 0)}</td>
                        <td className="px-3 py-2 text-right">
                          <Pill value={m.scrapPct} status={scrapStatus(m.scrapPct)} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.workOrders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>

            <ChartCard title="Üretim Emri Verimliliği (verimi en düşükten)">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-muted-foreground">
                    <tr>
                      <Th>Üretim emri</Th>
                      <Th>Ürün</Th>
                      <Th right>Tüketim (kg)</Th>
                      <Th right>Sağlam (kg)</Th>
                      <Th right>Verim</Th>
                      <Th right>Fire</Th>
                      <Th right>Overweight</Th>
                      <Th right>OEE</Th>
                      <Th right>Ref. hız</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.workOrders.map((w) => (
                      <tr key={w.workOrderId} className="border-b border-border last:border-0 even:bg-muted/30">
                        <td className="px-3 py-2">
                          <div className="font-medium">{w.workOrderNo}</div>
                          <div className="text-xs text-muted-foreground">{w.bomCode}</div>
                        </td>
                        <td className="max-w-xs px-3 py-2">
                          <div className="font-medium">{w.productCode}</div>
                          <div className="truncate text-xs text-muted-foreground">{w.productName}</div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTR(w.usedKg, 0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTR(w.goodKg, 0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{pct(w.materialYield, 2)}</td>
                        <td className="px-3 py-2 text-right">
                          <Pill value={w.scrapPct} status={scrapStatus(w.scrapPct)} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Pill value={w.overweightPct} status={owStatus(w.overweightPct)} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Pill value={w.oee} status={oeeStatus(w.oee)} d={1} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{pct(w.speedPerformance, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </Section>

          <p className="text-xs text-muted-foreground">
            Hesaplar: sağlam = hammadde − fire; overweight = sağlam / (üretilen × reçete birim ağırlığı) − 1; OEE = (vardiya süresi − duruş) /
            vardiya süresi; hız performansı = ideal süre / çalışma süresi; NŞA kapasite = Σ gün (o gün geçerli makine kapasitesi × kullanılabilir saat; tatil ve kapalı günler
            düşülür); zaman kullanımı = (vardiya süresi − duruş) / kullanılabilir saat; referansa göre hız = tüketim / (grup·çap·SDR
            referans kapasitesi × çalışma saati). Hedefler, kapasite ve takvim Yönetim&apos;den değiştirilir.
          </p>
        </>
      )}
    </div>
  );
}
