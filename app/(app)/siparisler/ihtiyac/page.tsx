import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { getMrpReport, getPurchaseData } from "@/app/actions/mrp";
import { PurchaseSuggestions } from "./components/purchase-suggestions";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatTR } from "@/lib/format";

export const metadata: Metadata = {
  title: "Net İhtiyaç (MRP)",
  description: "Açık siparişlere göre üretim ve hammadde ihtiyacı",
};

export const dynamic = "force-dynamic";

/** Birime göre ondalık: kg 2 basamak, adet/metre tam sayı */
const qty = (v: number, unit: string) => formatTR(v, unit === "kg" ? 2 : 0);
const date = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join(".") : "-");

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("px-3 py-2 font-medium", right && "text-right")}>{children}</th>
);

export default async function MrpPage() {
  await requirePermission("order:read");
  const report = await getMrpReport();
  const purchase = await getPurchaseData(report);
  const toSchedule = report.finished.filter((f) => f.toSchedule > 0).length;
  const shortages = report.materials.filter((m) => m.net > 0).length;
  const warnings = report.finished.filter((f) => f.warning);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Net İhtiyaç (MRP)"
        description="Açık siparişler, stok ve açık iş emirlerine göre üretilmesi ve temin edilmesi gerekenler"
        actions={
          <Link href="/siparisler" className={buttonVariants({ variant: "outline" })}>
            Siparişlere dön
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 pt-6">
            <div className="text-sm text-muted-foreground">Açık sipariş</div>
            <div className="text-3xl font-semibold tabular-nums">{report.openOrderCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-6">
            <div className="text-sm text-muted-foreground">İş emri açılması gereken ürün</div>
            <div className="text-3xl font-semibold tabular-nums">{toSchedule}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-6">
            <div className="text-sm text-muted-foreground">Eksik hammadde / ticari mal</div>
            <div className="text-3xl font-semibold tabular-nums">{shortages}</div>
          </CardContent>
        </Card>
      </div>

      {warnings.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            {warnings.map((f) => (
              <p key={f.product.id} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                <span>
                  <span className="font-medium">{f.product.code}</span> — {f.warning}
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mamul — Üretim İhtiyacı</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {report.finished.length === 0 ? (
            <p className="text-sm text-muted-foreground">Üretim gerektiren açık sipariş veya iş emri yok.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <Th>Ürün</Th>
                  <Th>En yakın termin</Th>
                  <Th right>Kalan sipariş</Th>
                  <Th right>Stok</Th>
                  <Th right>Üretilmesi gereken</Th>
                  <Th right>Açık iş emri</Th>
                  <Th right>İş emri açılmalı</Th>
                </tr>
              </thead>
              <tbody>
                {report.finished.map((f) => (
                  <tr key={f.product.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{f.product.code}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.product.name} · {f.bomCode} v{f.bomVersion}
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{date(f.earliestDue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{qty(f.demand, f.product.unit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{qty(f.stock, f.product.unit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{qty(f.netProduction, f.product.unit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{qty(f.openWorkOrderQty, f.product.unit)}</td>
                    <td className="px-3 py-2 text-right">
                      {f.toSchedule > 0 ? (
                        <Badge variant="outline" className="gap-1 tabular-nums">
                          <AlertTriangle className="h-3 w-3 text-warning" aria-hidden />
                          {qty(f.toSchedule, f.product.unit)} {f.product.unit}
                        </Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
                          Karşılanıyor
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hammadde ve Ticari Mal — Temin İhtiyacı</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {report.materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">Hammadde ihtiyacı yok.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <Th>Malzeme</Th>
                  <Th>İhtiyacı doğuran</Th>
                  <Th right>Brüt ihtiyaç</Th>
                  <Th right>Kullanılabilir stok</Th>
                  <Th right>Net eksik</Th>
                </tr>
              </thead>
              <tbody>
                {report.materials.map((m) => (
                  <tr key={m.product.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{m.product.code}</div>
                      <div className="text-xs text-muted-foreground">{m.product.name}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {m.sources
                        .map((s) =>
                          s.reason === "purchase"
                            ? `Doğrudan sipariş (${qty(s.qty, m.product.unit)} ${m.product.unit})`
                            : `${s.code} üretimi (${qty(s.qty, m.product.unit)} ${m.product.unit})`,
                        )
                        .join(" · ")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {qty(m.gross, m.product.unit)} {m.product.unit}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {qty(m.stock, m.product.unit)} {m.product.unit}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.net > 0 ? (
                        <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                          <AlertTriangle className="h-3.5 w-3.5 text-danger" aria-hidden />
                          {qty(m.net, m.product.unit)} {m.product.unit}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
                          Yeterli
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <PurchaseSuggestions data={purchase} />

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Hesap: kalan sipariş (teslim edilmemiş) − kullanılabilir stok (hurda/karantina hariç, negatif stok 0) = üretilmesi
        gereken. Hammadde, her ürünün en yüksek versiyonlu aktif reçetesiyle tek seviye patlatılır; açık iş emirlerinin
        kalan üretimi de hammadde planına dahildir. Reçetesiz ürünler doğrudan temin ihtiyacı sayılır.
      </p>
    </div>
  );
}
