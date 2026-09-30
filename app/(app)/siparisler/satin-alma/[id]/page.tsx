import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getPurchaseFormData, getPurchaseOrder } from "@/app/actions/purchase";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatTR } from "@/lib/format";
import { poStatusBadge, poStatusLabel } from "@/lib/purchase";
import { one } from "@/lib/utils";
import { PurchaseOrderActions } from "../components/purchase-order-actions";
import { PurchaseOrderForm } from "../components/purchase-order-form";

export const metadata: Metadata = { title: "Satın Alma Siparişi" };
export const dynamic = "force-dynamic";

const trDate = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join(".") : "—");
const qtyText = (v: number, unit: string) => formatTR(v, unit === "kg" ? 2 : 0);

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("order:read");
  const { id } = await params;
  const [{ po, items, receipts }, formData] = await Promise.all([getPurchaseOrder(id), getPurchaseFormData()]);
  const partner = one(po.partner);
  const creator = one(po.creator);

  // Taslak: yönetici burada düzenler
  const editable = po.status === "draft" && hasPermission("order:write", user.role);
  const total = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Satın Alma Siparişi ${po.no}`}
        description={`${partner?.name ?? ""} · ${trDate(po.order_date)}${creator?.name ? ` · oluşturan ${creator.name}` : ""}`}
        actions={
          <Link href="/siparisler/satin-alma" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Satın alma siparişleri
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={poStatusBadge(po.status)}>{poStatusLabel(po.status)}</Badge>
        {po.expected_date && <span className="text-sm text-muted-foreground">Beklenen teslim: {trDate(po.expected_date)}</span>}
        <div className="ml-auto">
          <PurchaseOrderActions
            id={po.id}
            no={po.no}
            status={po.status}
            warehouses={formData.warehouses}
            items={items.map((i) => {
              const p = one(i.product);
              return { id: i.id ?? "", code: p?.code ?? "", name: p?.name ?? "", unit: p?.unit ?? "", remaining: Number(i.remaining_qty ?? 0) };
            })}
          />
        </div>
      </div>

      {editable ? (
        <PurchaseOrderForm
          data={formData}
          initial={{
            id: po.id,
            partner_id: po.partner_id,
            order_date: po.order_date,
            expected_date: po.expected_date,
            currency: po.currency,
            note: po.note,
            items: items.map((i) => ({ product_id: i.product_id ?? "", quantity: Number(i.quantity), unit_price: i.unit_price !== null ? Number(i.unit_price) : null, note: i.note })),
          }}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kalemler</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Ürün</th>
                  <th className="px-3 py-2 text-right font-medium">Sipariş</th>
                  <th className="px-3 py-2 text-right font-medium">Teslim alınan</th>
                  <th className="px-3 py-2 text-right font-medium">Kalan</th>
                  <th className="px-3 py-2 text-right font-medium">Birim fiyat</th>
                  <th className="px-3 py-2 text-right font-medium">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const p = one(i.product);
                  const unit = p?.unit ?? "";
                  return (
                    <tr key={i.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{p?.code}</div>
                        <div className="text-xs text-muted-foreground">{p?.name}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {qtyText(Number(i.quantity), unit)} {unit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {qtyText(Number(i.received_qty ?? 0), unit)} {unit}
                      </td>
                      <td className={Number(i.remaining_qty) > 0 ? "px-3 py-2 text-right font-medium tabular-nums" : "px-3 py-2 text-right tabular-nums text-muted-foreground"}>
                        {qtyText(Number(i.remaining_qty ?? 0), unit)} {unit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{i.unit_price !== null ? `${formatTR(Number(i.unit_price))} ${po.currency}` : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatTR(Number(i.quantity) * Number(i.unit_price ?? 0))} {po.currency}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-right text-muted-foreground">
                    Toplam
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {formatTR(total)} {po.currency}
                  </td>
                </tr>
              </tfoot>
            </table>
            {po.note && <p className="mt-3 text-sm text-muted-foreground">Not: {po.note}</p>}
          </CardContent>
        </Card>
      )}

      {receipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Teslim alma kayıtları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {receipts.map((r) => {
              const doc = one(r.document);
              const wh = one(r.warehouse);
              const item = items.find((i) => i.id === r.source_id);
              const p = one(item?.product);
              return (
                <p key={r.id} className={doc?.cancelled_at ? "text-muted-foreground line-through" : ""}>
                  {formatDateTime(r.created_at ?? "")} · {doc?.no ?? "Fiş iptali (ters kayıt)"} · {p?.code} {r.direction === "in" ? "+" : "−"}
                  {qtyText(Number(r.quantity), p?.unit ?? "")} {p?.unit} · {wh?.name} · lot {r.lot_no ?? "—"}
                  {doc?.cancelled_at ? " (fiş iptal)" : ""}
                </p>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
