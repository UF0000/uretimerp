import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";

import { getProductDetail } from "@/app/actions/product-detail";
import { getProductInsights } from "@/app/actions/product-detail/insights";
import { getProductExtras } from "@/app/actions/product-detail/extras";
import { getProductGroups } from "@/app/actions/master-data/products";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTR } from "@/lib/format";
import { PRODUCT_TYPE_BADGE, PRODUCT_TYPE_LABELS, categoryLabel, type ProductType } from "@/lib/product-meta";
import { cn } from "@/lib/utils";
import { findBoxType, pipesPerPackage } from "@/lib/packaging";
import { ProductImage } from "./components/product-image";
import { TechnicalCard } from "./components/technical-card";
import { MovementChart } from "./components/movement-chart";
import { VariantsPanel } from "./components/variants-panel";
import { EditProductButton } from "./components/edit-product-button";
import { ActualCostSection, PerformanceSection, QualitySection, StockSection } from "./components/insight-sections";
import { DocumentsPanel } from "./components/documents-panel";
import { SuppliersPanel } from "./components/suppliers-panel";

export const metadata: Metadata = { title: "Ürün Ayrıntısı" };
export const dynamic = "force-dynamic";

const UNIT_LABEL: Record<string, string> = { adet: "adet", kg: "kg", metre: "m" };
const TABS = ["stok", "teknik", "uretim", "kalite", "maliyet", "paketleme", "dokumanlar", "tedarikciler", "varyantlar"] as const;
const tl = (v: number | null, d = 2) => (v === null ? "—" : `${formatTR(v, d)} ₺`);

const Field = ({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) => (
  <div className={className}>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="font-medium">{value ?? "—"}</dd>
  </div>
);

const Panel = ({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) => (
  <Card className={className}>
    {title && (
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
    )}
    <CardContent className={title ? undefined : "pt-6"}>{children}</CardContent>
  </Card>
);

type Tone = "ok" | "warn" | "bad" | "neutral";
const TONE_BORDER: Record<Tone, string> = { ok: "border-l-success", warn: "border-l-warning", bad: "border-l-danger", neutral: "border-l-border" };
const TONE_TEXT: Record<Tone, string> = { ok: "text-success", warn: "text-warning", bad: "text-danger", neutral: "" };
const Headline = ({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: Tone }) => (
  <div className={cn("rounded-md border border-l-4 border-border bg-card px-3 py-2.5", TONE_BORDER[tone])}>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={cn("text-2xl font-semibold tabular-nums", TONE_TEXT[tone])}>{value}</div>
    {hint && <div className="truncate text-xs text-muted-foreground">{hint}</div>}
  </div>
);

const Count = ({ n }: { n: number }) => (n > 0 ? <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{n}</span> : null);

export default async function ProductDetailPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ sekme?: string }> }) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const [detail, groups] = await Promise.all([getProductDetail(id), getProductGroups()]);
  if (!detail) notFound();
  const [insights, extras] = await Promise.all([getProductInsights(id), getProductExtras(id)]);
  const { product: p, technical: t, cost, components } = detail;
  const unit = UNIT_LABEL[p.unit] ?? p.unit;
  const type = p.type as ProductType;
  const isPipe = p.category === "boru" || t?.productionType === "extrusion";
  const isFitting = p.category === "baglanti_parcasi" || t?.productionType === "injection";
  const isPurchased = type === "raw" || type === "trade" || ["hammadde", "metal", "ambalaj", "sarf_malzeme", "yedek_parca"].includes(p.category ?? "") || extras.suppliers.length > 0;
  const perPallet = p.package_qty && p.pallet_qty ? Number(p.package_qty) * Number(p.pallet_qty) : null;
  const hasPackaging = [p.bag_type, p.bag_qty, p.package_type, p.package_qty, p.pallet_qty, p.pipe_length_m, p.package_weight_kg, p.barcode, p.package_note].some((v) => v !== null && v !== "");
  const boxType = findBoxType(p.package_type);
  const bagsPerBox = p.bag_qty && p.package_qty ? Number(p.package_qty) / Number(p.bag_qty) : null;
  const pipesPerPack = p.unit === "metre" ? pipesPerPackage(p.package_qty, p.pipe_length_m) : null;
  const tab = TABS.includes(sp.sekme as (typeof TABS)[number]) && (sp.sekme !== "tedarikciler" || isPurchased) ? sp.sekme! : "stok";

  const s = insights.stock;
  const stockTone: Tone = p.critical_stock > 0 && detail.stock <= p.critical_stock ? "bad" : p.min_stock > 0 && detail.stock <= p.min_stock ? "warn" : "ok";
  const availTone: Tone = s.available < 0 ? "bad" : s.reserved > 0 && s.available < s.reserved * 0.2 ? "warn" : "ok";
  const d = insights.depletion;
  const depTone: Tone = d.daysLeft === null ? "neutral" : d.daysLeft < 15 ? "bad" : d.daysLeft < 45 ? "warn" : "ok";
  const size = [p.diameter_mm && `Ø${formatTR(p.diameter_mm, 0)}`, p.wall_thickness_mm && `${formatTR(p.wall_thickness_mm, 1)} mm`, p.sdr && `SDR ${formatTR(p.sdr, 1)}`].filter(Boolean).join(" · ");
  const qcCount = insights.quality.checks.length + insights.quality.ncrs.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/ana-veri" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Ürün listesi
        </Link>
        <EditProductButton product={{ ...p, type, unit_cost: p.unit_cost ?? 0, currency: p.currency ?? "TRY" }} groups={groups} />
      </div>

      {/* ── Ana bilgi ── */}
      <Card>
        <CardContent className="grid gap-6 pt-6 md:grid-cols-[220px_1fr]">
          <ProductImage productId={p.id} name={p.name} url={p.image_url} />
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
                <Badge variant={PRODUCT_TYPE_BADGE[type] ?? "default"}>{PRODUCT_TYPE_LABELS[type] ?? p.type}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{p.code}</span> · {categoryLabel(p.category)} · birim: {p.unit}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 xl:grid-cols-5">
              <Field label="Grup kodu" value={p.group_code || "—"} />
              <Field label="Genel stok kodu" value={p.variant_code ?? "—"} />
              <Field label="Malzeme" value={[p.material_group, p.material_grade].filter(Boolean).join(" · ") || "—"} />
              <Field label="Boyut" value={size || "—"} />
              <Field label="Kart fiyatı" value={p.unit_cost ? `${formatTR(p.unit_cost)} ${p.currency ?? "TRY"}` : "—"} />
              {p.description && <Field label="Açıklama" value={p.description} className="col-span-2 sm:col-span-3 xl:col-span-5" />}
            </dl>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Headline label="Mevcut stok" value={`${formatTR(detail.stock, 0)} ${unit}`} hint={`min ${formatTR(p.min_stock, 0)} · kritik ${formatTR(p.critical_stock, 0)}`} tone={stockTone} />
              <Headline label="Kullanılabilir (boşta)" value={`${formatTR(s.available, 0)} ${unit}`} hint={s.reserved > 0 ? `${formatTR(s.reserved, 0)} ${unit} siparişe ayrılmış` : "ayrılmış sipariş yok"} tone={availTone} />
              <Headline label="Tahmini tükenme" value={d.daysLeft === null ? "—" : `${formatTR(d.daysLeft, 0)} gün`} hint={d.daysLeft === null ? "son 90 günde çıkış yok" : "son 90 gün ortalamasıyla"} tone={depTone} />
              <Headline label="Standart birim maliyet" value={tl(cost.total)} hint={cost.missing.length ? "eksik veriyle hesaplandı" : `/ ${unit}`} tone={cost.missing.length ? "warn" : "neutral"} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Bölümler ── */}
      <Tabs key={tab} defaultValue={tab} className="w-full">
        <TabsList className="mb-4 max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="stok">Stok</TabsTrigger>
          <TabsTrigger value="teknik">Teknik</TabsTrigger>
          <TabsTrigger value="uretim">Üretim</TabsTrigger>
          <TabsTrigger value="kalite">
            Kalite
            <Count n={qcCount} />
          </TabsTrigger>
          <TabsTrigger value="maliyet">Maliyet</TabsTrigger>
          <TabsTrigger value="paketleme">Paketleme</TabsTrigger>
          <TabsTrigger value="dokumanlar">
            Dokümanlar
            <Count n={extras.documents.length} />
          </TabsTrigger>
          {isPurchased && (
            <TabsTrigger value="tedarikciler">
              Tedarikçiler
              <Count n={extras.suppliers.length} />
            </TabsTrigger>
          )}
          <TabsTrigger value="varyantlar">
            Varyantlar
            <Count n={detail.variants.length} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stok" className="m-0 space-y-4">
          <Panel title="Stok ve rezervasyon">
            <StockSection insights={insights} unit={unit} />
          </Panel>
          <Panel title="Yıllık hareket (son 12 ay)">
            <MovementChart data={detail.monthly} unit={unit} />
          </Panel>
        </TabsContent>

        <TabsContent value="teknik" className="m-0 space-y-4">
          <Panel title="Boyut / ebat">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-5">
              <Field label="Çap" value={p.diameter_mm ? `${formatTR(p.diameter_mm, 1)} mm` : "—"} />
              <Field label="Et kalınlığı" value={p.wall_thickness_mm ? `${formatTR(p.wall_thickness_mm, 2)} mm` : "—"} />
              <Field label="SDR" value={p.sdr ? formatTR(p.sdr, 1) : "—"} />
              {isPipe && <Field label="Metre ağırlığı" value={t?.kgPerMeter ? `${formatTR(t.kgPerMeter, 3)} kg/m` : "—"} />}
              {isFitting && <Field label="Parça ağırlığı" value={t?.productWeightG ? `${formatTR(t.productWeightG, 1)} g` : "—"} />}
            </dl>
          </Panel>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title={isPipe ? "Teknik veriler — Boru" : isFitting ? "Teknik veriler — Fitting" : "Teknik veriler"}>
              {t ? (
                <TechnicalCard productId={p.id} technical={t} />
              ) : (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  Bu ürünün aktif reçetesi yok. Üretim hızı, çevrim süresi ve ağırlık reçeteyle birlikte tutulur.{" "}
                  <Link href="/recete/yeni" className="text-primary underline-offset-2 hover:underline">
                    Reçete oluştur
                  </Link>
                </p>
              )}
            </Panel>
            <Panel title="Hammadde (reçeteden)">
              {components.length === 0 ? (
                <p className="text-sm text-muted-foreground">Reçetede hammadde yok.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Hammadde</th>
                        <th className="px-3 py-2 text-right font-medium">Oran</th>
                        <th className="px-3 py-2 text-right font-medium">Kart fiyatı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {components.map((c) => (
                        <tr key={c.id} className="border-b border-border last:border-0 even:bg-muted/30">
                          <td className="px-3 py-2">
                            <Link href={`/ana-veri/urunler/${c.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                              {c.code}
                            </Link>{" "}
                            <span className="text-muted-foreground">{c.name}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{c.ratioPct !== null ? `%${formatTR(c.ratioPct, 1)}` : formatTR(c.quantity, 3)}</td>
                          <td className={cn("px-3 py-2 text-right tabular-nums", !c.unitCost && "text-danger")}>{c.unitCost ? `${formatTR(c.unitCost)} ${c.currency ?? "TRY"}` : "fiyat yok"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="uretim" className="m-0">
          <Panel title="Üretim performansı (son 12 ay)">
            {t ? <PerformanceSection insights={insights} /> : <p className="text-sm text-muted-foreground">Bu ürün üretilmiyor (aktif reçetesi yok).</p>}
          </Panel>
        </TabsContent>

        <TabsContent value="kalite" className="m-0">
          <Panel title="Kalite geçmişi">
            <QualitySection insights={insights} />
          </Panel>
        </TabsContent>

        <TabsContent value="maliyet" className="m-0">
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Standart maliyet (otomatik, birim başına)">
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Standart birim maliyet</span>
                  <span className="text-3xl font-semibold tabular-nums text-primary">
                    {tl(cost.total)} <span className="text-base font-normal text-muted-foreground">/ {unit}</span>
                  </span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="py-1.5">
                        Hammadde
                        <span className="ml-1 text-xs text-muted-foreground">{cost.kgPerUnit !== null ? `${formatTR(cost.kgPerUnit, 4)} kg × ${formatTR(cost.avgKgPrice)} ₺/kg` : ""}</span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{tl(cost.material)}</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-1.5">İşçilik</td>
                      <td className="py-1.5 text-right tabular-nums">{tl(cost.labor)}</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-1.5">Enerji</td>
                      <td className="py-1.5 text-right tabular-nums">{tl(cost.energy)}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5">Genel gider</td>
                      <td className="py-1.5 text-right tabular-nums">{tl(cost.overhead)}</td>
                    </tr>
                  </tbody>
                </table>
                {cost.missing.length > 0 && (
                  <p className="flex items-start gap-2 rounded-md bg-warning/15 px-3 py-2 text-xs">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                    Maliyet eksik hesaplanıyor: {cost.missing.join(", ")}.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Reçete ve hammadde kart fiyatlarından; işçilik, enerji, genel gider ve kurlar Yönetim → Parametreler&apos;den.</p>
              </div>
            </Panel>
            <Panel title="Gerçekleşen maliyet (biten iş emirleri)">
              <ActualCostSection insights={insights} standard={cost.total} unit={unit} />
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="paketleme" className="m-0">
          <Panel title="Paketleme">
            {hasPackaging ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                {(p.bag_type || p.bag_qty) && (
                  <>
                    <Field label="İç poşet" value={p.bag_type || "—"} />
                    <Field label="Poşet içi" value={p.bag_qty ? `${formatTR(Number(p.bag_qty), 0)} ${unit}` : "—"} />
                    <Field label="Kutuda poşet" value={bagsPerBox ? formatTR(bagsPerBox, bagsPerBox % 1 ? 1 : 0) : "—"} />
                    <div className="hidden sm:block" />
                  </>
                )}
                <Field label="Kutu / paket tipi" value={p.package_type ? (boxType ? `${boxType.name} (${boxType.size})` : p.package_type) : "—"} />
                <Field
                  label="Kutu / paket içi"
                  value={p.package_qty ? `${formatTR(Number(p.package_qty), 0)} ${unit}${pipesPerPack ? ` (${formatTR(pipesPerPack, pipesPerPack % 1 ? 1 : 0)} boru)` : ""}` : "—"}
                />
                <Field label="Palet başına kutu" value={p.pallet_qty ? `${formatTR(Number(p.pallet_qty), 0)}${boxType ? ` (${boxType.layout})` : ""}` : "—"} />
                <Field label="Palet başına miktar" value={perPallet ? `${formatTR(perPallet, 0)} ${unit}` : "—"} />
                {(isPipe || p.pipe_length_m) && <Field label="Boy uzunluğu" value={p.pipe_length_m ? `${formatTR(Number(p.pipe_length_m), 2)} m` : "—"} />}
                <Field label="Paket ağırlığı" value={p.package_weight_kg ? `${formatTR(Number(p.package_weight_kg), 2)} kg` : "—"} />
                <Field label="Barkod" value={p.barcode || "—"} />
                {p.package_note && <Field label="Not" value={p.package_note} className="col-span-2" />}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Paketleme bilgisi girilmemiş. &quot;Kartı düzenle&quot; → Paketleme bölümünden eklenir.</p>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="dokumanlar" className="m-0">
          <Panel title="Teknik dokümanlar">
            <DocumentsPanel productId={p.id} documents={extras.documents} />
          </Panel>
        </TabsContent>

        {isPurchased && (
          <TabsContent value="tedarikciler" className="m-0">
            <Panel title="Tedarikçiler ve alış fiyatları">
              <SuppliersPanel productId={p.id} extras={extras} />
            </Panel>
          </TabsContent>
        )}

        <TabsContent value="varyantlar" className="m-0">
          <Panel title="Varyantlar">
            <VariantsPanel detail={detail} />
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
