import type { ProductionAnalyticsReport } from "@/app/actions/analytics";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatTR } from "@/lib/format";
import { MOLD_MODE_LABELS } from "@/lib/product-meta";
import { AnalyticsFilters } from "./analytics-filters";
import { CyclePerfBars, DistributionDonut, MaterialScrapBars, MaterialScrapPct, ShiftComparison, ShiftProduction } from "./analytics-charts";
import { ChartCard, Kpi, Section, pct, statusHigh, statusOf } from "./dashboard-ui";

/**
 * Fitting (enjeksiyon) analiz panosu — referans görseller e1–e5.
 * Hesaplar Boru panosuyla aynı (lib/production-analytics.ts); burada enjeksiyona özgü
 * göstergeler: adet, yolluk, çevrim performansı (ideal / gerçek), kalıp çalışma tipi.
 */

const kg3 = (v: number) => formatTR(v, 3);
const hours = (v: number) => `${formatTR(v, 1)} sa`;
const shareOf = (part: number, whole: number) => (whole > 0 ? `%${formatTR((part / whole) * 100, 1)}` : "—");
const SHIFT_NAME = { day: "GÜNDÜZ", night: "GECE" } as const;

export function InjectionDashboard({ report, from, to }: { report: ProductionAnalyticsReport; from: string; to: string }) {
  const { analytics: a, options, days } = report;
  const t = a.total;
  const tg = a.targets;
  const rec = a.scrapRecovery;
  const families = [...new Set(a.shifts.flatMap((s) => Object.keys(s.materialsKg)))];
  const noMode = a.workOrders.filter((w) => !w.moldMode && w.performance !== null).length;

  const exportSheets = [
    {
      name: "Özet",
      rows: [
        { Gösterge: "Sağlam (kg)", Değer: t.goodKg },
        { Gösterge: "Tüketim (kg)", Değer: t.usedKg },
        ...a.rawMaterials.map((m) => ({ Gösterge: `Tüketim — ${m.name} (kg)`, Değer: m.usedKg })),
        { Gösterge: "Üretim (adet)", Değer: t.producedPcs },
        { Gösterge: "Fire (kg)", Değer: t.scrapKg },
        { Gösterge: "Geri dönüşümlü fire (kg)", Değer: rec.regrindKg },
        { Gösterge: "Kayıp fire (kg)", Değer: rec.lostKg },
        { Gösterge: "Ort. fire (%)", Değer: t.scrapPct === null ? null : t.scrapPct * 100 },
        { Gösterge: "Materyal verim (%)", Değer: t.materialYield === null ? null : t.materialYield * 100 },
        { Gösterge: "Ort. OE (%)", Değer: t.oee === null ? null : t.oee * 100 },
        { Gösterge: "Çevrim performansı (%)", Değer: t.performance === null ? null : t.performance * 100 },
        { Gösterge: "Yolluk (kg)", Değer: t.runnerKg },
        { Gösterge: "Brüt üretim süresi (sa)", Değer: t.plannedHours },
        { Gösterge: "Duruş süresi (sa)", Değer: t.downtimeHours },
        { Gösterge: "Net üretim süresi (sa)", Değer: t.runHours },
      ],
    },
    {
      name: "Ürün çevrim",
      rows: a.byProduct.map((p) => ({
        Ürün: p.label,
        Açıklama: p.productName,
        "Üretim (adet)": p.producedPcs,
        "Sağlam (kg)": p.goodKg,
        "Fire (%)": p.scrapPct === null ? null : p.scrapPct * 100,
        "Çevrim perf. (%)": p.performance === null ? null : p.performance * 100,
        "OE (%)": p.oee === null ? null : p.oee * 100,
      })),
    },
    {
      name: "İş emirleri",
      rows: a.workOrders.map((w) => ({
        "Üretim emri": w.workOrderNo,
        Ürün: `${w.productCode} ${w.productName}`,
        "Kalıp çalışma": w.moldMode ? MOLD_MODE_LABELS[w.moldMode] : null,
        "Üretim (adet)": w.producedPcs,
        "Tüketim (kg)": w.usedKg,
        "Sağlam (kg)": w.goodKg,
        "Fire (%)": w.scrapPct === null ? null : w.scrapPct * 100,
        "Çevrim perf. (%)": w.performance === null ? null : w.performance * 100,
        "OE (%)": w.oee === null ? null : w.oee * 100,
        "Yolluk (kg)": w.runnerKg,
      })),
    },
    {
      name: "Hammadde",
      rows: a.rawMaterials.map((m) => ({
        Hammadde: m.name,
        "Tüketim (kg)": m.usedKg,
        "Fire (kg)": m.scrapKg,
        "Geri dön. (kg)": m.regrindKg,
        "Kayıp (kg)": m.lostKg,
        "Fire (%)": m.scrapPct === null ? null : m.scrapPct * 100,
      })),
    },
    { name: "Makine", rows: a.byLine.map((r) => ({ Makine: r.label, "Sağlam (kg)": r.goodKg, "Üretim (adet)": r.producedPcs, "Fire (%)": r.scrapPct === null ? null : r.scrapPct * 100, "Duruş (dk)": r.downtimeMin })) },
    { name: "Fire nedenleri", rows: a.scrapReasons.map((r) => ({ Kod: r.code, Neden: r.label, "Fire (kg)": r.value, "Pay (%)": r.share * 100 })) },
    { name: "Duruş nedenleri", rows: a.downtimeReasons.map((r) => ({ Kod: r.code, Neden: r.label, "Duruş (dk)": r.value, "Pay (%)": r.share * 100 })) },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Enjeksiyon — Fitting Analizi"
        description={`Fitting iş emirlerinin adet, fire ve çevrim performansı · ${from.split("-").reverse().join(".")} – ${to.split("-").reverse().join(".")} (${days} gün) · ${a.workOrders.length} iş emri · ${a.outOfTargetCount} uyarı`}
      />

      <AnalyticsFilters from={from} to={to} lineType="injection" options={options} exportSheets={exportSheets} />

      {t.entries === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Bu filtrelerle enjeksiyon vardiya girişi yok. Tarih aralığını genişletin veya filtreleri temizleyin.
          </CardContent>
        </Card>
      ) : (
        <>
          <Section title="Üretim ve kalite özeti" description="Hedeflere göre renkli: yeşil hedefte, turuncu sınırda, kırmızı hedef dışı">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi title="Sağlam (kg)" value={kg3(t.goodKg)} accent="border-l-[var(--cat-2)]" />
              <Kpi
                title="Tüketim (kg)"
                value={kg3(t.usedKg)}
                accent="border-l-[var(--cat-1)]"
                rows={a.rawMaterials.map((m) => ({ label: m.name, value: kg3(m.usedKg), share: shareOf(m.usedKg, t.usedKg) }))}
              />
              <Kpi title="Üretim (adet)" value={formatTR(t.producedPcs, 0)} accent="border-l-[var(--cat-1)]" />
              <Kpi
                title="Fire (kg)"
                value={kg3(t.scrapKg)}
                accent="border-l-[var(--cat-3)]"
                rows={[
                  { label: "Geri dön.", value: kg3(rec.regrindKg), share: `${shareOf(rec.regrindKg, t.scrapKg)} / ${shareOf(rec.regrindKg, t.usedKg)}` },
                  { label: "Kayıp", value: kg3(rec.lostKg), share: `${shareOf(rec.lostKg, t.scrapKg)} / ${shareOf(rec.lostKg, t.usedKg)}` },
                ]}
              />
              <Kpi title="Ort. fire" value={pct(t.scrapPct, 2)} status={statusOf(t.scrapPct === null ? null : t.scrapPct * 100, tg.scrapPct)} hint={`hedef ≤ %${formatTR(tg.scrapPct, 1)}`} />
              <Kpi
                title="Materyal verim"
                value={pct(t.materialYield, 1)}
                status={statusHigh(t.materialYield === null ? null : t.materialYield * 100, 100)}
                hint="sağlam / tüketim · hedef %100"
              />
              <Kpi title="Ort. OE" value={pct(t.oee, 2)} status={statusHigh(t.oee === null ? null : t.oee * 100, tg.oeePct)} hint={`hedef ≥ %${formatTR(tg.oeePct, 0)}`} />
              <Kpi
                title="Çevrim perf."
                value={pct(t.performance, 2)}
                status={statusHigh(t.performance === null ? null : t.performance * 100, 100)}
                hint={t.performance === null ? "reçete/kalıpta çevrim yok" : "ideal / gerçek çevrim · hedef %100"}
              />
              <Kpi title="Yolluk (kg)" value={kg3(t.runnerKg)} hint="atış × atış başı yolluk" accent="border-l-[var(--cat-3)]" />
              <Kpi title="İş emri brüt üretim süresi" value={hours(t.plannedHours)} hint="girişlerin saat aralığı" accent="border-l-[var(--cat-5)]" />
              <Kpi title="Duruş süresi" value={hours(t.downtimeHours)} accent="border-l-[var(--cat-5)]" />
              <Kpi title="Net üretim süresi" value={hours(t.runHours)} hint="brüt − duruş" accent="border-l-[var(--cat-5)]" />
            </div>
          </Section>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Hammadde Tüketimi Dağılımı (KG)">
              <DistributionDonut data={a.rawMaterials.map((m) => ({ name: m.name, value: m.usedKg }))} unit="kg" colorBy="family" empty="Tüketim kaydı yok." />
            </ChartCard>
            <ChartCard title="Fire — Hammadde Bazında (KG)">
              <MaterialScrapBars rows={a.rawMaterials.map((m) => ({ name: m.name, lostKg: m.lostKg, regrindKg: m.regrindKg }))} />
            </ChartCard>
            <ChartCard title="Fire Oranı — Hammadde Bazında (%)">
              <MaterialScrapPct rows={a.rawMaterials.filter((m) => m.scrapPct !== null).map((m) => ({ name: m.name, pct: m.scrapPct! * 100 }))} target={tg.scrapPct} />
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <ChartCard title="Ürün Bazlı Çevrim Performansı (%)" description={`${a.byProduct.length} ürün · hedeften en uzak ürünler önce · hedef %100`} className="lg:col-span-2">
              <CyclePerfBars
                noun="ürün"
                rows={a.byProduct.filter((p) => p.performance !== null).map((p) => ({ key: p.key, label: p.label, sublabel: p.productName, value: p.performance! * 100 }))}
              />
            </ChartCard>
            <ChartCard title="Vardiya Bazlı Üretim">
              <ShiftProduction data={a.shifts.map((s) => ({ name: SHIFT_NAME[s.shift], kg: s.goodKg, qty: s.producedPcs }))} />
            </ChartCard>
            <ChartCard title="Fire Türü Dağılımı (KG)">
              <DistributionDonut
                data={[
                  { name: "Kayıp fire", value: rec.lostKg },
                  { name: "Geri dönüşümlü fire", value: rec.regrindKg },
                ]}
                unit="kg"
                empty="Fire kaydı yok."
              />
            </ChartCard>
          </div>

          <ChartCard title="Vardiya Karşılaştırması">
            <ShiftComparison
              qtyUnit="Adet"
              families={families}
              data={a.shifts.map((s) => ({
                name: SHIFT_NAME[s.shift],
                kg: s.goodKg,
                qty: s.producedPcs,
                scrapPct: (s.scrapPct ?? 0) * 100,
                oeePct: (s.oee ?? 0) * 100,
                downtimeMin: s.downtimeHours * 60,
                materials: s.materialsKg,
              }))}
            />
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Makine Bazlı Üretim (Sağlam KG)">
              <DistributionDonut data={a.byLine.map((r) => ({ name: r.label, value: r.goodKg }))} unit="kg" empty="Makine kaydı yok." />
            </ChartCard>
            <ChartCard title="Fire Nedenleri (KG)">
              <DistributionDonut data={a.scrapReasons.map((r) => ({ name: r.label, value: r.value }))} unit="kg" empty="Nedeni girilmiş fire yok." />
            </ChartCard>
            <ChartCard title="Duruş Nedenleri (DK)">
              <DistributionDonut data={a.downtimeReasons.map((r) => ({ name: r.label, value: r.value }))} unit="dk" empty="Duruş kaydı yok." />
            </ChartCard>
          </div>

          {/* Otomatik kalıpta operatör etkisi yok: çevrim performansı yalnızca yarı otomatik kalıplarda izlenir */}
          <ChartCard title="Yarı Otomatik Kalıp — Çevrim Performansı (%)" description="Her bant tek iş emridir: üst satır üretim emri, alt satır üretilen stok kodu.">
            <CyclePerfBars
              noun="iş emri"
              rows={a.workOrders
                .filter((w) => w.moldMode === "yari_otomatik" && w.performance !== null)
                .map((w) => ({ key: w.workOrderId, label: w.workOrderNo, sublabel: `Ürün: ${w.productCode}`, value: w.performance! * 100 }))}
            />
          </ChartCard>
          {noMode > 0 && (
            <p className="text-xs text-muted-foreground">
              {noMode} iş emrinin kalıbında çalışma tipi (otomatik / yarı otomatik) girilmemiş; Ana Veri → Kalıplar&apos;dan girilebilir.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Hesaplar: sağlam = hammadde − fire; materyal verim = sağlam / tüketim; OE = (brüt süre − duruş) / brüt süre; çevrim performansı = ideal süre
            (reçete/kalıp çevrimi × atış) / net üretim süresi; yolluk = (üretilen adet / göz) × atış başı yolluk. Hedefler Yönetim → Parametreler&apos;den
            değiştirilir.
          </p>
        </>
      )}
    </div>
  );
}
