import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getShipment } from "@/app/actions/shipments";
import { requirePermission } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatTR } from "@/lib/format";
import { ShipmentActions } from "../components/shipment-actions";

export const metadata: Metadata = { title: "Sevk İrsaliyesi" };
export const dynamic = "force-dynamic";

const trDate = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join(".") : "—");
const qtyText = (v: number, unit: string) => formatTR(v, unit === "kg" ? 2 : 0);

/** Yazdırılabilir sevk irsaliyesi (A4). Yasal e-İrsaliye değildir; muhasebe / GİB entegrasyonu kapsam dışı. */
export default async function ShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("order:read");
  const { id } = await params;
  const detail = await getShipment(id);
  if (!detail) notFound();
  const { shipment: s, lines } = detail;
  const cancelled = Boolean(s.cancelled_at);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/siparisler/sevkiyat" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Sevkiyatlar
        </Link>
        <ShipmentActions id={s.id} no={s.no} cancelled={cancelled} />
      </div>

      {cancelled && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger print:hidden">
          Bu irsaliye {formatDateTime(s.cancelled_at ?? "")} tarihinde iptal edildi; stok geri alındı.
        </div>
      )}

      {/* Belge */}
      <article className="mx-auto max-w-[210mm] space-y-6 rounded-md border border-border bg-card p-4 text-sm sm:p-8 print:max-w-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6 border-b border-border pb-4">
          <div className="rounded-md bg-logo-surface p-1">
            <Image src="/logo-sifonik.png" alt="Sifonik" width={319} height={89} className="h-12 w-auto" />
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold tracking-tight">SEVK İRSALİYESİ</h1>
            <p className="font-mono text-base font-semibold">{s.no}</p>
            {cancelled && <Badge variant="destructive">İPTAL</Badge>}
          </div>
        </header>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Alıcı</p>
            <p className="font-semibold">{s.partner?.name}</p>
            {s.delivery_address && <p className="whitespace-pre-line">{s.delivery_address}</p>}
            {s.partner?.phone && <p>Tel: {s.partner.phone}</p>}
          </div>
          <div className="space-y-1">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Sevk tarihi</dt>
              <dd className="font-medium">{trDate(s.ship_date)}</dd>
              <dt className="text-muted-foreground">Sipariş no</dt>
              <dd className="font-medium">{s.order?.no ?? "—"}</dd>
              <dt className="text-muted-foreground">Çıkış deposu</dt>
              <dd>{s.warehouse?.name ?? "—"}</dd>
              <dt className="text-muted-foreground">Araç plakası</dt>
              <dd>{s.vehicle_plate ?? "—"}</dd>
              <dt className="text-muted-foreground">Şoför</dt>
              <dd>{s.driver_name ?? "—"}</dd>
            </dl>
          </div>
        </section>

        <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-border text-left">
              <th className="px-2 py-2 font-semibold">#</th>
              <th className="px-2 py-2 font-semibold">Stok kodu</th>
              <th className="px-2 py-2 font-semibold">Ürün adı</th>
              <th className="px-2 py-2 font-semibold">Lot</th>
              <th className="px-2 py-2 text-right font-semibold">Miktar</th>
              <th className="px-2 py-2 font-semibold">Birim</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} className="border-b border-border">
                <td className="px-2 py-2 tabular-nums">{i + 1}</td>
                <td className="px-2 py-2 font-medium">{l.product?.code}</td>
                <td className="px-2 py-2">{l.product?.name}</td>
                <td className="px-2 py-2">{l.lot_no ?? "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums">{qtyText(Number(l.quantity), l.product?.unit ?? "")}</td>
                <td className="px-2 py-2">{l.product?.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {s.note && (
          <p>
            <span className="font-semibold">Not:</span> {s.note}
          </p>
        )}

        <footer className="grid grid-cols-3 gap-3 pt-10 sm:gap-6">
          {["Teslim eden", "Taşıyan", "Teslim alan"].map((t) => (
            <div key={t} className="space-y-10 text-center">
              <p className="font-semibold">{t}</p>
              <p className="border-t border-border pt-1 text-xs text-muted-foreground">Ad Soyad / İmza</p>
            </div>
          ))}
        </footer>
        <p className="text-center text-xs text-muted-foreground">
          Düzenleyen: {s.creator?.name ?? "—"} · {formatDateTime(s.created_at)}
        </p>
      </article>
    </div>
  );
}
