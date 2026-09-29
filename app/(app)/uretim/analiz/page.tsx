import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";

import { getProductionAnalytics } from "@/app/actions/analytics";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AnalyticsFilters } from "./components/analytics-filters";
import {
  ActualVsExpected,
  MaterialDonut,
  ShiftBars,
  ShiftMaterialStack,
  StatusBars,
} from "./components/analytics-charts";
import { STATUS_LABELS, type Status } from "@/lib/analytics-status";

export const metadata: Metadata = {
  title: "Üretim Analizi",
  description: "Ekstrüder / enjeksiyon üretim, fire, overweight, kapasite ve OEE takip panosu",
};

export const dynamic = "force-dynamic";

type SearchParams = { bas?: string; bit?: string; tur?: string; hat?: string; vardiya?: string; urun?: string; ie?: string; hammadde?: string };

const isDate = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
const pct = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? "—" : `%${formatTR(v * 100, d)}`);
const kg = (v: number, d = 0) => `${formatTR(v, d)} kg`;

/** Hedefe göre durum: hedefte ≤ hedef, sınırda ≤ hedef × 1,2, üstü hedef dışı. */
const statusOf = (valuePct: number | null, targetPct: number): Status => {
  if (valuePct === null) return "ok";
  if (valuePct <= targetPct) return "ok";
  return valuePct <= targetPct * 1.2 ? "warn" : "bad";
};
const STATUS_TEXT: Record<Status, string> = { ok: "text-success", warn: "text-warning", bad: "text-danger" };

const Kpi = ({ title, value, hint, status }: { title: string; value: string; hint?: string; status?: Status }) => (
  <Card className="break-inside-avoid">
    <CardContent className="space-y-1 pt-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
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

const ReasonBars = ({ title, rows, unit }: { title: string; rows: { id: string; code: string; label: string; value: number; share: number }[]; unit: string }) => (
  <Card className="break-inside-avoid">
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Kayıt yok.</p>
      ) : (
        <ol className="space-y-2.5">
          {rows.slice(0, 10).map((r) => (
            <li key={r.id} className="space-y-1" title={`${r.code} ${r.label}: ${formatTR(r.value, 1)} ${unit}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">
                  <span className="font-medium">{r.code}</span> <span className="text-muted-foreground">{r.label}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatTR(r.value, 1)} {unit} <span className="text-xs text-muted-foreground">({pct(r.share, 0)})</span>
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
          {rows.length > 10 && <li className="text-xs text-muted-foreground">+{rows.length - 10} neden daha (Excel çıktısında tamamı var)</li>}
        </ol>
      )}
    </CardContent>
  </Card>
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

export default async function ProductionAnalyticsPage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  // Bugün Türkiye saatine göre (UTC gece yarısından sonraki gece vardiyası girişleri kaçmasın)
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  const from = isDate(sp.bas) ? sp.bas! : `${today.slice(0, 4)}-01-01`;
  const to = isDate(sp.bit) ? sp.bit! : today;
  const lineType = sp.tur === "enjeksiyon" ? "injection" : "extrusion";

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
  const shiftName = { day: "Gündüz", night: "Gece" } as const;
  const lineCount = a.capacity.linesWithCapacity + a.capacity.linesWithoutCapacity;

  const exportSheets = [
    {
      name: "Özet",
      rows: [
        { Gösterge: "Sağlam (kg)", Değer: t.goodKg },
        { Gösterge: "Tüketim (kg)", Değer: t.usedKg },
        { Gösterge: isExtrusion ? "Üretim (m)" : "Üretim (adet)", Değer: isExtrusion ? t.producedM : t.producedPcs },
        { Gösterge: "Fire (kg)", Değer: t.scrapKg },
        { Gösterge: "Fire (%)", Değer: t.scrapPct === null ? null : t.scrapPct * 100 },
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
        title={isExtrusion ? "Ekstrüder — Boru" : "Enjeksiyon"}
        description={`Üretim, fire, overweight, kapasite ve OEE · ${from.split("-").reverse().join(".")} – ${to.split("-").reverse().join(".")} (${days} gün) · ${a.workOrders.length} iş emri · ${t.entries} vardiya girişi`}
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
          <Section title="Üretim ve kalite özeti" description="Sağlam kütle, tüketim, üretim, fire; fire, overweight, OEE ve malzeme verimi hedefleriyle">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi title="Sağlam (kg)" value={formatTR(t.goodKg, 1)} />
              <Kpi title="Tüketim (kg)" value={formatTR(t.usedKg, 1)} />
              <Kpi title={isExtrusion ? "Üretim (m)" : "Üretim (adet)"} value={formatTR(isExtrusion ? t.producedM : t.producedPcs, isExtrusion ? 1 : 0)} />
              <Kpi title="Fire (kg)" value={formatTR(t.scrapKg, 1)} />
              <Kpi title="Ort. fire" value={pct(t.scrapPct, 2)} status={statusOf(t.scrapPct === null ? null : t.scrapPct * 100, tg.scrapPct)} hint={`hedef ≤ %${formatTR(tg.scrapPct, 1)}`} />
              <Kpi
                title="Ort. overweight"
                value={pct(t.overweightPct, 2)}
                status={t.overweightPct === null ? undefined : statusOf(Math.abs(t.overweightPct * 100), tg.overweightTolerancePct)}
                hint={t.overweightPct === null ? "reçetede birim ağırlık yok" : `tolerans ±%${formatTR(tg.overweightTolerancePct, 1)}`}
              />
              <Kpi
                title="OEE"
                value={pct(t.oee, 1)}
                status={t.oee === null ? undefined : t.oee * 100 >= tg.oeePct ? "ok" : t.oee * 100 >= tg.oeePct * 0.85 ? "warn" : "bad"}
                hint={`hedef ≥ %${formatTR(tg.oeePct, 0)}`}
              />
              <Kpi title="Materyal verim" value={pct(t.materialYield, 1)} hint="sağlam / tüketim" />
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
                <Kpi title="Makine-saat ağırlıklı kapasite" value={a.capacity.weightedCapacityKgPerHour === null ? "—" : `${formatTR(a.capacity.weightedCapacityKgPerHour, 1)} kg/sa`} />
                <Kpi title="Makine bazlı NŞA kapasite" value={kg(a.capacity.nsaCapacityKg)} hint={`${a.capacity.linesWithCapacity} makine × ${formatTR(lineCount ? a.capacity.availableLineHours / lineCount : 0, 0)} kullanılabilir saat`} />
                <Kpi title="Kapasite verimi" value={pct(a.capacity.capacityEfficiency)} hint="tüketim / NŞA kapasite" />
                <Kpi title="Aktif sürede kapasite" value={pct(a.capacity.activeCapacityPct)} hint="çalışılan sürede" />
                <Kpi title="Zaman kullanımı" value={pct(a.capacity.timeUtilization)} hint="çalışma / kullanılabilir süre" />
                <Kpi title="OEE performansı" value={pct(t.performance)} hint="ideal / gerçek çalışma süresi" />
                <Kpi
                  title="Referansa göre hız"
                  value={pct(t.speedPerformance)}
                  hint={t.speedPerformance === null ? "referans kapasite yok (Yönetim)" : `girişlerin ${pct(t.referenceCoverage, 0)}'inde referans var`}
                />
                <Kpi title="Referansa göre beklenen" value={kg(t.referenceExpectedKg)} hint="referans × çalışma saati" />
                <Kpi title="Fiili sürede beklenen" value={kg(a.capacity.expectedKg)} hint="kapasite × çalışma saati" />
                <Kpi title="Çalışma / duruş" value={`${formatTR(t.runHours, 1)} / ${formatTR(t.downtimeHours, 1)} sa`} />
              </div>
            )}
            {a.capacity.linesWithoutCapacity > 0 && a.capacity.linesWithCapacity > 0 && (
              <p className="text-xs text-muted-foreground">{a.capacity.linesWithoutCapacity} makinede kapasite girilmemiş; hesaba katılmadı.</p>
            )}
          </Section>

          <Section title="Dağılım" description="Hammadde tüketimi (aileye göre), fire ve duruş nedenleri">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="break-inside-avoid">
                <CardHeader>
                  <CardTitle className="text-base">Hammadde Tüketimi (kg)</CardTitle>
                </CardHeader>
                <CardContent>
                  <MaterialDonut data={a.rawMaterials.map((m) => ({ name: m.name, value: m.usedKg }))} />
                </CardContent>
              </Card>
              <ReasonBars title="Fire Nedenleri (kg)" rows={a.scrapReasons} unit="kg" />
              <ReasonBars title="Duruş Nedenleri (dk)" rows={a.downtimeReasons} unit="dk" />
            </div>
          </Section>

          <Section title="Vardiya karşılaştırması" description="Gündüz ve gece vardiyasında üretim, hammadde, fire, OEE ve duruş">
            <Card>
              <CardContent className="grid gap-6 pt-5 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <h3 className="mb-1 text-sm font-medium">Sağlam (kg)</h3>
                  <ShiftBars data={a.shifts.map((s) => ({ name: shiftName[s.shift], value: s.goodKg }))} unit="kg" />
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium">{isExtrusion ? "Üretim (m)" : "Üretim (adet)"}</h3>
                  <ShiftBars data={a.shifts.map((s) => ({ name: shiftName[s.shift], value: isExtrusion ? s.producedM : s.producedPcs }))} unit={isExtrusion ? "m" : "adet"} />
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium">Hammadde tüketimi (kg)</h3>
                  <ShiftMaterialStack
                    families={families}
                    data={a.shifts.map((s) => ({ name: shiftName[s.shift], ...s.materialsKg }))}
                  />
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium">Ort. fire (%)</h3>
                  <ShiftBars data={a.shifts.map((s) => ({ name: shiftName[s.shift], value: (s.scrapPct ?? 0) * 100 }))} unit="%" decimals={2} />
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium">OEE (%)</h3>
                  <ShiftBars data={a.shifts.map((s) => ({ name: shiftName[s.shift], value: (s.oee ?? 0) * 100 }))} unit="%" decimals={1} />
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium">Duruş (dk)</h3>
                  <ShiftBars data={a.shifts.map((s) => ({ name: shiftName[s.shift], value: s.downtimeHours * 60 }))} unit="dk" />
                </div>
              </CardContent>
            </Card>
          </Section>

          <Section title="İş emri performansı" description="İş emri bazında fire, overweight ve kapasiteye göre tüketim">
            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="break-inside-avoid">
                <CardHeader>
                  <CardTitle className="text-base">Üretim Emri Bazlı Fire (%)</CardTitle>
                </CardHeader>
                <CardContent>
                  <StatusBars
                    rows={a.workOrders
                      .filter((w) => w.scrapPct !== null)
                      .map((w) => ({ label: w.workOrderNo, sublabel: w.productCode, value: w.scrapPct! * 100, status: statusOf(w.scrapPct! * 100, tg.scrapPct) }))}
                    references={[{ value: tg.scrapPct, label: `hedef %${formatTR(tg.scrapPct, 1)}` }]}
                  />
                </CardContent>
              </Card>
              <Card className="break-inside-avoid">
                <CardHeader>
                  <CardTitle className="text-base">Üretim Emri Bazlı Overweight (%)</CardTitle>
                </CardHeader>
                <CardContent>
                  <StatusBars
                    diverging
                    rows={a.workOrders
                      .filter((w) => w.overweightPct !== null)
                      .map((w) => ({
                        label: w.workOrderNo,
                        sublabel: w.productCode,
                        value: w.overweightPct! * 100,
                        status: statusOf(Math.abs(w.overweightPct! * 100), tg.overweightTolerancePct),
                      }))}
                    references={[
                      { value: -tg.overweightTolerancePct, label: `−%${formatTR(tg.overweightTolerancePct, 1)}` },
                      { value: tg.overweightTolerancePct, label: `+%${formatTR(tg.overweightTolerancePct, 1)}` },
                    ]}
                  />
                </CardContent>
              </Card>
              <Card className="break-inside-avoid xl:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Gerçek Tüketim vs Kapasiteye Göre Beklenen (kg)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ActualVsExpected
                    rows={a.workOrders
                      .filter((w) => w.expectedKg > 0)
                      .sort((x, y) => y.expectedKg - x.expectedKg)
                      .map((w) => ({ label: w.workOrderNo, actual: w.usedKg, expected: w.expectedKg }))}
                  />
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section
            title="Kontrol öncelikleri"
            description={`Hedef dışı iş emirleri, en büyük sapma önce · fire ≤ %${formatTR(tg.scrapPct, 1)} · overweight ±%${formatTR(tg.overweightTolerancePct, 1)}`}
          >
            <Card>
              <CardContent className="space-y-3 pt-5">
                <p className="text-sm">
                  <span className="text-2xl font-semibold tabular-nums">{a.outOfTargetCount}</span>
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
                          <span className="ml-2 text-muted-foreground">{w.productCode} {w.productName}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs">
                          {w.scrapDeviation !== null && w.scrapDeviation > 0 && (
                            <span className="text-danger">
                              Fire {pct(w.scrapPct, 2)} · hedefin +{formatTR(w.scrapDeviation, 2)} puan üstü
                            </span>
                          )}
                          {w.overweightDeviation !== null && w.overweightDeviation > 0 && (
                            <span className="text-danger">
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hammadde Özeti</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b border-border">
                      {["Hammadde", "Tüketim (kg)", "Sağlam çıktı (kg)", "Verim", "Fire (kg)", "Geri dön. (kg)", "Kayıp (kg)", "Fire", "Üretim emri"].map((h, i) => (
                        <th key={h} className={cn("px-3 py-2 font-medium", i > 0 && "text-right")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {a.rawMaterials.map((m) => (
                      <tr key={m.productId} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium">{m.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTR(m.usedKg, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTR(m.goodKg, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{pct(m.yieldPct, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTR(m.scrapKg, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTR(m.regrindKg, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTR(m.lostKg, 2)}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", STATUS_TEXT[statusOf(m.scrapPct === null ? null : m.scrapPct * 100, tg.scrapPct)])}>{pct(m.scrapPct, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.workOrders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Üretim Emri Verimliliği (verimi en düşükten)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b border-border">
                      {["Üretim emri", "Ürün", "Tüketim (kg)", "Sağlam (kg)", "Verim", "Fire", "Overweight", "OEE", "Ref. hız"].map((h, i) => (
                        <th key={h} className={cn("px-3 py-2 font-medium", i > 1 && "text-right")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {a.workOrders.map((w) => (
                      <tr key={w.workOrderId} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <div className="font-medium">{w.workOrderNo}</div>
                          <div className="text-xs text-muted-foreground">{w.bomCode}</div>
                        </td>
                        <td className="max-w-xs px-3 py-2">
                          <div className="font-medium">{w.productCode}</div>
                          <div className="truncate text-xs text-muted-foreground">{w.productName}</div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTR(w.usedKg, 1)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTR(w.goodKg, 1)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{pct(w.materialYield, 2)}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", STATUS_TEXT[statusOf(w.scrapPct === null ? null : w.scrapPct * 100, tg.scrapPct)])}>{pct(w.scrapPct, 2)}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", w.overweightPct !== null && STATUS_TEXT[statusOf(Math.abs(w.overweightPct * 100), tg.overweightTolerancePct)])}>{pct(w.overweightPct, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{pct(w.oee, 1)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{pct(w.speedPerformance, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </Section>

          <p className="text-xs text-muted-foreground">
            Hesaplar: sağlam = hammadde − fire; overweight = sağlam / (üretilen × reçete birim ağırlığı) − 1; NŞA kapasite = Σ gün (o gün
            geçerli makine kapasitesi × kullanılabilir saat; tatil ve kapalı günler düşülür); zaman kullanımı = (vardiya süresi − duruş) /
            kullanılabilir saat; referansa göre hız = tüketim / (grup·çap·SDR referans kapasitesi × çalışma saati). Hedefler, kapasite ve
            takvim Yönetim&apos;den değiştirilir. <Link href="/uretim/oee" className="underline-offset-2 hover:underline">OEE raporu</Link> ·{" "}
            <Link href="/uretim/fire" className="underline-offset-2 hover:underline">Fire raporu</Link>
          </p>
        </>
      )}
    </div>
  );
}
