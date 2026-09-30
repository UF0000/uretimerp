import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";

import { getPurchaseOrders } from "@/app/actions/purchase";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DELIVERY_LABELS, poStatusBadge, poStatusLabel } from "@/lib/purchase";
import { formatTR } from "@/lib/format";

export const metadata: Metadata = {
  title: "Satın Alma Siparişleri",
  description: "Tedarikçilere verilen siparişler ve teslim alma",
};

export const dynamic = "force-dynamic";

const trDate = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join(".") : "—");

export default async function PurchaseOrdersPage() {
  const user = await requirePermission("order:read");
  const orders = await getPurchaseOrders();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });

  return (
    <div className="space-y-6">
      <PageHeader
back={{ href: "/siparisler", label: "Siparişler" }}
                title="Satın Alma Siparişleri"
        description="Tedarikçilere verilen siparişler; teslim alınınca stok girişi otomatik yapılır"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/siparisler/ihtiyac" className={buttonVariants({ variant: "outline" })}>
              <ListChecks className="mr-2 h-4 w-4" />
              Satın alma önerisi
            </Link>
            {hasPermission("order:write", user.role) && (
              <Link href="/siparisler/satin-alma/yeni" className={buttonVariants()}>
                <Plus className="mr-2 h-4 w-4" />
                Yeni satın alma siparişi
              </Link>
            )}
          </div>
        }
      />
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henüz satın alma siparişi yok. Net ihtiyaç sayfasındaki satın alma önerisinden ya da &quot;Yeni satın alma siparişi&quot; ile oluşturun.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Sipariş no</th>
                  <th className="px-3 py-2 font-medium">Tedarikçi</th>
                  <th className="px-3 py-2 font-medium">Tarih</th>
                  <th className="px-3 py-2 font-medium">Beklenen</th>
                  <th className="px-3 py-2 font-medium">Durum</th>
                  <th className="px-3 py-2 font-medium">Teslim</th>
                  <th className="px-3 py-2 text-right font-medium">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const late = o.status === "ordered" && o.expectedDate && o.expectedDate < today && o.delivery !== "full";
                  return (
                    <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-2">
                        <Link href={`/siparisler/satin-alma/${o.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                          {o.no}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{o.partner?.name ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{trDate(o.orderDate)}</td>
                      <td className={late ? "px-3 py-2 font-medium tabular-nums text-danger" : "px-3 py-2 tabular-nums"}>{trDate(o.expectedDate)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={poStatusBadge(o.status)}>{poStatusLabel(o.status)}</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {o.status === "draft" || o.status === "cancelled" ? "—" : `${DELIVERY_LABELS[o.delivery]} (%${formatTR(o.receivedPct * 100, 0)})`}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatTR(o.total)} {o.currency}
                      </td>
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
