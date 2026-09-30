import type { Metadata } from "next";
import Link from "next/link";

import { getShipments } from "@/app/actions/shipments";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sevkiyatlar",
  description: "Müşteri siparişlerine yapılan sevkiyatlar ve irsaliyeler",
};
export const dynamic = "force-dynamic";

const trDate = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join(".") : "—");

export default async function ShipmentsPage() {
  await requirePermission("order:read");
  const shipments = await getShipments();

  return (
    <div className="space-y-6">
      <PageHeader back={{ href: "/siparisler", label: "Siparişler" }}
        title="Sevkiyatlar" description="Siparişlere yapılan sevkiyatlar; yeni sevkiyat Siparişler listesinde siparişin “Sevk et” düğmesiyle yapılır" />
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          {shipments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz sevkiyat yok.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">İrsaliye no</th>
                  <th className="px-3 py-2 font-medium">Tarih</th>
                  <th className="px-3 py-2 font-medium">Müşteri</th>
                  <th className="px-3 py-2 font-medium">Sipariş</th>
                  <th className="px-3 py-2 font-medium">Araç</th>
                  <th className="px-3 py-2 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <Link href={`/siparisler/sevkiyat/${s.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                        {s.no}
                      </Link>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{trDate(s.ship_date)}</td>
                    <td className="px-3 py-2">{s.partner?.name ?? "—"}</td>
                    <td className="px-3 py-2">{s.order?.no ?? "—"}</td>
                    <td className="px-3 py-2">{s.vehicle_plate ?? "—"}</td>
                    <td className="px-3 py-2">{s.cancelled_at ? <Badge variant="destructive">İptal</Badge> : <Badge variant="secondary">Sevk edildi</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
