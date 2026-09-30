import type { Metadata } from "next";
import Link from "next/link";

import { getStockCounts } from "@/app/actions/stock-counts";
import { getWarehouses } from "@/app/actions/master-data/warehouses";
import { getProductGroups } from "@/app/actions/master-data/products";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NewCountDialog } from "./components/new-count-dialog";

export const metadata: Metadata = {
  title: "Stok Sayımı",
  description: "Depo sayım listeleri, sayılan miktarlar ve sayım farkları",
};
export const dynamic = "force-dynamic";

const trDate = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join(".") : "—");
const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Sayılıyor", variant: "default" },
  completed: { label: "Tamamlandı", variant: "secondary" },
  cancelled: { label: "İptal", variant: "destructive" },
};

export default async function StockCountsPage() {
  const user = await requirePermission("master-data:read");
  const [counts, warehouses, groups] = await Promise.all([getStockCounts(), getWarehouses(), getProductGroups()]);

  return (
    <div className="space-y-6">
      <PageHeader
back={{ href: "/depo", label: "Stok durumu" }}
                title="Stok Sayımı"
        description="Sayım listesi oluşturun, sayılan miktarları girin; tamamlayınca farklar sayım fazlası / eksiği fişiyle stoğa işlenir"
        actions={hasPermission("stock:write", user.role) ? <NewCountDialog warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))} groups={groups} /> : null}
      />
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          {counts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz sayım yok.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Sayım no</th>
                  <th className="px-3 py-2 font-medium">Tarih</th>
                  <th className="px-3 py-2 font-medium">Depo</th>
                  <th className="px-3 py-2 font-medium">Kapsam</th>
                  <th className="px-3 py-2 font-medium">Durum</th>
                  <th className="px-3 py-2 text-right font-medium">Sayılan</th>
                  <th className="px-3 py-2 text-right font-medium">Fark çıkan</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((c) => {
                  const st = STATUS[c.status] ?? { label: c.status, variant: "outline" as const };
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-2">
                        <Link href={`/depo/sayim/${c.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                          {c.no}
                        </Link>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{trDate(c.date)}</td>
                      <td className="px-3 py-2">{c.warehouse}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.scope}</td>
                      <td className="px-3 py-2">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {c.counted} / {c.total}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.status === "completed" ? c.differences : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
