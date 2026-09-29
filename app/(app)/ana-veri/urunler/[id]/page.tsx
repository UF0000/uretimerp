import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";

import { getProductDetail } from "@/app/actions/product-detail";
import { getProductInsights } from "@/app/actions/product-detail/insights";
import { getProductExtras } from "@/app/actions/product-detail/extras";
import { getProductGroups } from "@/app/actions/master-data/products";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTR } from "@/lib/format";
import { PRODUCT_TYPE_BADGE, PRODUCT_TYPE_LABELS, categoryLabel, type ProductType } from "@/lib/product-meta";
import { cn } from "@/lib/utils";
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
const tl = (v: number | null, d = 2) => (v === null ? "—" : `${formatTR(v, d)} ₺`);

const Field = ({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) => (
  <div className={className}>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="font-medium">{value ?? "—"}</dd>
  </div>
);

const Section = ({ title, children, className, action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) => (
  <Card className={className}>
    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
      <CardTitle className="text-base">{title}</CardTitle>
      {action}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

export default async function ProductDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
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
  const hasPackaging = [p.package_type, p.package_qty, p.pallet_qty, p.pipe_length_m, p.package_weight_kg, p.barcode, p.package_note].some((v) => v !== null && v !== "");

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.name}
        description={`${p.code} · ${PRODUCT_TYPE_LABELS[type] ?? p.type} · ${categoryLabel(p.category)}`}
        actions={
          <>
            <Link href="/ana-veri" className={buttonVariants({ variant: "ghost" })}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Ürün listesi
            </Link>
            <EditProductButton
              product={{
                ...p,
                type,
                unit_cost: p.unit_cost ?? 0,
                currency: p.currency ?? "TRY",
              }}
              groups={groups}
            />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardContent className="pt-6">
            <ProductImage productId={p.id} name={p.name} url={p.image_url} />
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Genel bilgiler">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="Stok kodu" value={p.code} />
              <Field label="Birim" value={p.unit} />
              <Field label="Ürün türü" value={<Badge variant={PRODUCT_TYPE_BADGE[type] ?? "default"}>{PRODUCT_TYPE_LABELS[type] ?? p.type}</Badge>} />
              <Field label="Ürün ailesi" value={categoryLabel(p.category)} />
              <Field label="Grup kodu" value={p.group_code ? `${p.group_code}${detail.groupName ? ` — ${detail.groupName}` : ""}` : "—"} />
              <Field label="Genel stok kodu (varyant)" value={p.variant_code ?? "—"} />
              <Field label="Malzeme grubu" value={p.material_group ?? "—"} />
              {p.material_grade && <Field label="Malzeme grade" value={p.material_grade} />}
              {p.description && <Field label="Açıklama" value={p.description} className="col-span-2" />}
            </dl>
          </Section>

          <Section title="Stok">
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">Mevcut stok (tüm depolar)</div>
                <div
                  className={cn(
                    "text-3xl font-semibold tabular-nums",
                    p.critical_stock > 0 && detail.stock <= p.critical_stock ? "text-danger" : p.min_stock > 0 && detail.stock <= p.min_stock ? "text-warning" : "text-success",
                  )}
                >
                  {formatTR(detail.stock, 0)} <span className="text-base font-normal text-muted-foreground">{unit}</span>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Min. stok" value={`${formatTR(p.min_stock, 0)} ${unit}`} />
                <Field label="Kritik stok" value={`${formatTR(p.critical_stock, 0)} ${unit}`} />
                <Field label="Kullanılabilir (boşta)" value={<span className={insights.stock.available < 0 ? "text-danger" : ""}>{`${formatTR(insights.stock.available, 0)} ${unit}`}</span>} />
                <Field label="Tahmini tükenme" value={insights.depletion.daysLeft === null ? "—" : `${formatTR(insights.depletion.daysLeft, 0)} gün`} />
                <Field label="Kart birim fiyatı" value={p.unit_cost ? `${formatTR(p.unit_cost)} ${p.currency ?? "TRY"}` : "—"} />
              </dl>
            </div>
          </Section>

          <Section title="Boyut / ebat" className="md:col-span-2">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-5">
              <Field label="Çap" value={p.diameter_mm ? `${formatTR(p.diameter_mm, 1)} mm` : "—"} />
              <Field label="Et kalınlığı" value={p.wall_thickness_mm ? `${formatTR(p.wall_thickness_mm, 2)} mm` : "—"} />
              <Field label="SDR" value={p.sdr ? formatTR(p.sdr, 1) : "—"} />
              {isPipe && <Field label="Metre ağırlığı" value={t?.kgPerMeter ? `${formatTR(t.kgPerMeter, 3)} kg/m` : "—"} />}
              {isFitting && <Field label="Parça ağırlığı" value={t?.productWeightG ? `${formatTR(t.productWeightG, 1)} g` : "—"} />}
            </dl>
          </Section>

          <Section title="Paketleme" className="md:col-span-2">
            {hasPackaging ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                <Field label="Paket tipi" value={p.package_type || "—"} />
                <Field label="Paket içi" value={p.package_qty ? `${formatTR(Number(p.package_qty), 0)} ${unit}` : "—"} />
                <Field label="Palet başına paket" value={p.pallet_qty ? formatTR(Number(p.pallet_qty), 0) : "—"} />
                <Field label="Palet başına miktar" value={perPallet ? `${formatTR(perPallet, 0)} ${unit}` : "—"} />
                {(isPipe || p.pipe_length_m) && <Field label="Boy uzunluğu" value={p.pipe_length_m ? `${formatTR(Number(p.pipe_length_m), 2)} m` : "—"} />}
                <Field label="Paket ağırlığı" value={p.package_weight_kg ? `${formatTR(Number(p.package_weight_kg), 2)} kg` : "—"} />
                <Field label="Barkod" value={p.barcode || "—"} />
                {p.package_note && <Field label="Not" value={p.package_note} className="col-span-2" />}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Paketleme bilgisi girilmemiş. &quot;Kartı düzenle&quot; → Paketleme bölümünden eklenir.</p>
            )}
          </Section>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title={isPipe ? "Teknik veriler — Boru" : isFitting ? "Teknik veriler — Fitting" : "Teknik veriler"}>
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
        </Section>

        <Section title="Hammadde (reçeteden)">
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
        </Section>
      </div>

      <Section title="Stok ve rezervasyon">
        <StockSection insights={insights} unit={unit} />
      </Section>

      <Section title="Yıllık hareket (son 12 ay)">
        <MovementChart data={detail.monthly} unit={unit} />
      </Section>

      {t && (
        <Section title="Üretim performansı (son 12 ay)">
          <PerformanceSection insights={insights} />
        </Section>
      )}

      <Section title="Kalite geçmişi">
        <QualitySection insights={insights} />
      </Section>

      <Section title="Teknik dokümanlar">
        <DocumentsPanel productId={p.id} documents={extras.documents} />
      </Section>

      {isPurchased && (
        <Section title="Tedarikçiler ve alış fiyatları">
          <SuppliersPanel productId={p.id} extras={extras} />
        </Section>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Maliyet (otomatik, birim başına)">
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
                    <span className="ml-1 text-xs text-muted-foreground">
                      {cost.kgPerUnit !== null ? `${formatTR(cost.kgPerUnit, 4)} kg × ${formatTR(cost.avgKgPrice)} ₺/kg` : ""}
                    </span>
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
            <p className="text-xs text-muted-foreground">
              Reçete ve hammadde kart fiyatlarından; işçilik, enerji, genel gider ve kurlar Yönetim → Parametreler&apos;den. Gerçekleşen maliyet{" "}
              <Link href="/maliyet" className="text-primary underline-offset-2 hover:underline">
                Maliyet
              </Link>{" "}
              sayfasında.
            </p>
          </div>
        </Section>

        <Section title="Gerçekleşen maliyet (biten iş emirleri)">
          <ActualCostSection insights={insights} standard={cost.total} unit={unit} />
        </Section>
      </div>

      <Section title="Varyantlar">
        <VariantsPanel detail={detail} />
      </Section>
    </div>
  );
}
