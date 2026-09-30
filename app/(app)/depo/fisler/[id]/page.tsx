import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getStockDocumentById } from "@/app/actions/stock";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime, formatTR } from "@/lib/format";
import { STOCK_DOCUMENT_PRINT, STOCK_DOCUMENT_TYPE_LABELS, stockDocumentKind } from "@/lib/stock-documents";
import { one } from "@/lib/utils";
import { StockDocumentActions } from "../components/stock-document-actions";

export const metadata: Metadata = { title: "Depo Fişi" };
export const dynamic = "force-dynamic";

const trDate = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join(".") : "—");
const qtyText = (v: number, unit: string) => formatTR(v, unit === "kg" ? 2 : 0);

/** Yazdırılabilir depo giriş / çıkış / transfer fişi (A4) */
export default async function StockDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("master-data:read");
  const { id } = await params;
  const doc = await getStockDocumentById(id);
  if (!doc) notFound();
  const supabase = await createClient();
  const { data: shipment } = await supabase.from("shipments").select("id").eq("document_id", id).maybeSingle();

  const kind = stockDocumentKind(doc.type);
  const print = STOCK_DOCUMENT_PRINT[kind];
  const source = one(doc.source);
  const target = one(doc.target);
  const user = one(doc.user);
  const cancelled = Boolean(doc.cancelled_at);
  // Transferde her kalem çıkış + giriş olarak iki harekettir: belgede bir kez (çıkış) gösterilir
  const lines = (doc.items ?? []).filter((m) => (kind === "transfer" ? m.direction === "out" : true)).map((m) => ({ ...m, product: one(m.product) }));
  // Birim bazında toplam
  const totals = new Map<string, number>();
  for (const l of lines) totals.set(l.product?.unit ?? "", (totals.get(l.product?.unit ?? "") ?? 0) + Number(l.quantity));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/depo/fisler" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Stok fişleri
        </Link>
        <StockDocumentActions id={doc.id} no={doc.no} cancelled={cancelled} shipmentId={shipment?.id ?? null} />
      </div>

      {cancelled && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger print:hidden">
          Bu fiş {formatDateTime(doc.cancelled_at ?? "")} tarihinde iptal edildi; hareketleri ters kayıtla geri alındı.
        </div>
      )}

      <article className="mx-auto max-w-[210mm] space-y-6 rounded-md border border-border bg-card p-4 text-sm sm:p-8 print:max-w-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div className="rounded-md bg-logo-surface p-1">
            <Image src="/logo-sifonik.png" alt="Sifonik" width={319} height={89} className="h-12 w-auto" />
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold tracking-tight">{print.title}</h1>
            <p className="text-base font-semibold">{doc.no}</p>
            <p className="text-muted-foreground">{STOCK_DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type}</p>
            {cancelled && <Badge variant="destructive">İPTAL</Badge>}
          </div>
        </header>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr_auto_1fr] print:grid-cols-[auto_1fr_auto_1fr]">
          <dt className="text-muted-foreground">Fiş tarihi</dt>
          <dd className="font-medium">{trDate(doc.document_date)}</dd>
          <dt className="text-muted-foreground">Düzenleyen</dt>
          <dd>{user?.name ?? "—"}</dd>
          {kind !== "giris" && (
            <>
              <dt className="text-muted-foreground">Çıkış deposu</dt>
              <dd className="font-medium">{source?.name ?? "—"}</dd>
            </>
          )}
          {kind !== "cikis" && (
            <>
              <dt className="text-muted-foreground">Giriş deposu</dt>
              <dd className="font-medium">{target?.name ?? "—"}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Kayıt zamanı</dt>
          <dd>{formatDateTime(doc.created_at ?? "")}</dd>
        </dl>

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
              <th className="px-2 py-2 font-semibold">Açıklama</th>
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
                <td className="px-2 py-2 text-muted-foreground">{l.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="px-2 py-2 text-right font-semibold">
                Toplam ({lines.length} kalem)
              </td>
              <td colSpan={3} className="px-2 py-2 font-semibold tabular-nums">
                {[...totals.entries()].map(([u, v]) => `${qtyText(v, u)} ${u}`).join(" · ")}
              </td>
            </tr>
          </tfoot>
        </table>
        </div>

        {doc.note && (
          <p>
            <span className="font-semibold">Açıklama:</span> {doc.note}
          </p>
        )}

        <footer className="grid grid-cols-3 gap-3 pt-10 sm:gap-6">
          {print.signatures.map((t) => (
            <div key={t} className="space-y-10 text-center">
              <p className="font-semibold">{t}</p>
              <p className="border-t border-border pt-1 text-xs text-muted-foreground">Ad Soyad / İmza</p>
            </div>
          ))}
        </footer>
      </article>
    </div>
  );
}
