import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Info, Search } from "lucide-react";

import { getLotTrace, getRecentLots } from "@/app/actions/traceability";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatTR } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "İzlenebilirlik",
  description: "Lot soyağacı: hammaddeden sevkiyata",
};

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  production: "Üretim",
  sale: "Satış / Sevk",
  purchase: "Satınalma",
  count: "Sayım",
  transfer: "Transfer",
  scrap: "Fire / Hurda",
};
const SHIFT_LABELS: Record<string, string> = { day: "Gündüz", night: "Gece" };
const QC_RESULT: Record<string, string> = { accept: "Kabul", reject: "Red", conditional: "Şartlı kabul" };
const QC_TYPE: Record<string, string> = { incoming: "Giriş", process: "Proses", final: "Final" };

const dateTime = (d: string | null) =>
  d
    ? new Date(d).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "-";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-sm font-medium">{children}</div>
  </div>
);

export default async function TraceabilityPage(props: { searchParams: Promise<{ lot?: string }> }) {
  const { lot } = await props.searchParams;
  const query = lot?.trim() ?? "";
  const [recent, trace] = await Promise.all([getRecentLots(), query ? getLotTrace(query) : null]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="İzlenebilirlik (Lot Soyağacı)"
        description="Bir lotun hangi iş emri, vardiya ve hammaddeden geldiğini ve nereye gittiğini gösterir"
        actions={
          <Link href="/depo" className={buttonVariants({ variant: "outline" })}>
            Stoka dön
          </Link>
        }
      />

      <Card>
        <CardContent className="space-y-3 pt-6">
          <form className="flex gap-2" action="/depo/izlenebilirlik">
            <Input name="lot" defaultValue={query} placeholder="Lot no, örn. L260929-IE-001-1" className="max-w-md" />
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" />
              Lotu izle
            </Button>
          </form>
          {recent.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Son lotlar:</span>
              {recent.map((r) => (
                <Link
                  key={r.lot_no}
                  href={`/depo/izlenebilirlik?lot=${encodeURIComponent(r.lot_no)}`}
                  className={cn(
                    "rounded-md border px-2 py-0.5 font-mono text-xs transition-colors hover:bg-accent",
                    r.lot_no === query ? "border-primary" : "border-border",
                  )}
                  title={`${r.product?.code ?? ""} ${r.product?.name ?? ""}`}
                >
                  {r.lot_no}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {trace && !trace.found && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            &quot;{trace.lotNo}&quot; numaralı lot bulunamadı.
          </CardContent>
        </Card>
      )}

      {trace?.found && (
        <>
          {/* Lot kartı */}
          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-base">{trace.lotNo}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="Ürün">
                {trace.lot?.product ? `${trace.lot.product.code} — ${trace.lot.product.name}` : trace.movements[0]?.product?.code ?? "-"}
              </Field>
              <Field label="Üretim tarihi">{trace.lot?.production_date?.split("-").reverse().join(".") ?? "-"}</Field>
              <Field label="İş emri">{trace.workOrder?.no ?? "Üretim dışı lot (ör. satınalma)"}</Field>
              <Field label="Reçete">
                {trace.workOrder?.bom
                  ? `${trace.workOrder.bom.code} v${trace.workOrder.bom.version} · ${trace.workOrder.bom.name}`
                  : "-"}
              </Field>
              <Field label="Hat / Kalıp">
                {trace.workOrder?.line?.name ?? trace.workOrder?.mold?.name ?? "-"}
              </Field>
              {trace.entry && (
                <>
                  <Field label="Vardiya">
                    {SHIFT_LABELS[trace.entry.shift]} · {dateTime(trace.entry.entry_time)}
                  </Field>
                  <Field label="Operatör / Giren">
                    {trace.entry.operator ?? "-"} / {trace.entry.user?.name ?? "-"}
                  </Field>
                  <Field label="Üretim / Fire">
                    {formatTR(Number(trace.entry.produced_qty), 0)} {trace.lot?.product?.unit} ·{" "}
                    {formatTR(Number(trace.entry.scrap_qty), 2)} kg fire
                    {trace.entry.scrap_reason && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {trace.entry.scrap_reason.code} {trace.entry.scrap_reason.label}
                      </span>
                    )}
                  </Field>
                  {Number(trace.entry.downtime_min) > 0 && (
                    <Field label="Duruş">
                      {formatTR(Number(trace.entry.downtime_min), 0)} dk
                      {trace.entry.downtime_reason && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {trace.entry.downtime_reason.code} {trace.entry.downtime_reason.label}
                        </span>
                      )}
                    </Field>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Geriye: hammadde */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Geriye: Kullanılan Hammadde</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {trace.consumed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {trace.entry
                      ? "Bu vardiya girişine bağlı tüketim kaydı yok (izlenebilirlik bağlantısından önceki bir kayıt olabilir)."
                      : "Bu lot bir üretim girişine bağlı değil."}
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {trace.consumed.map((c) => (
                      <li key={c.product_id} className="flex justify-between gap-3">
                        <span>
                          <span className="font-medium">{c.product?.code}</span>{" "}
                          <span className="text-muted-foreground">{c.product?.name}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          {c.lot_no ? (
                            <Link
                              href={`/depo/izlenebilirlik?lot=${encodeURIComponent(c.lot_no)}`}
                              className="font-mono text-xs underline-offset-2 hover:underline"
                              title="Kesin reçine lotu"
                            >
                              {c.lot_no}
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">lot kaydı yok</span>
                          )}
                          <span className="tabular-nums">{formatTR(Number(c.quantity), 2)} kg</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {trace.candidateLots.length > 0 && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      Olası reçine lotları: tüketimde lot seçilmediği için kesin değildir; üretimden önce depoya giren lotlu
                      girişler en yeniden eskiye listelenir.
                    </p>
                    <ul className="space-y-1 text-sm">
                      {trace.candidateLots.slice(0, 8).map((c, i) => (
                        <li key={`${c.lot_no}-${i}`} className="flex justify-between gap-3">
                          <Link
                            href={`/depo/izlenebilirlik?lot=${encodeURIComponent(c.lot_no ?? "")}`}
                            className="font-mono text-xs underline-offset-2 hover:underline"
                          >
                            {c.product?.code} · {c.lot_no}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {dateTime(c.created_at)} · {formatTR(Number(c.quantity), 2)} kg
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Kalite */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Kalite Kontrol ve NCR</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {trace.qualityChecks.length === 0 && trace.ncrs.length === 0 && (
                  <p className="text-muted-foreground">Bu lota bağlı kalite kaydı yok.</p>
                )}
                {trace.qualityChecks.map((q) => (
                  <div key={q.id} className="flex items-center justify-between gap-3">
                    <span>
                      {QC_TYPE[q.type]} kontrol {q.standard ? `· ${q.standard}` : ""}
                      <span className="block text-xs text-muted-foreground">{dateTime(q.checked_at)}</span>
                    </span>
                    <Badge variant={q.result === "reject" ? "destructive" : "outline"}>{QC_RESULT[q.result]}</Badge>
                  </div>
                ))}
                {trace.ncrs.map((n) => (
                  <div key={n.id} className="flex items-center justify-between gap-3">
                    <span>
                      NCR {n.no} · {n.description}
                      <span className="block text-xs text-muted-foreground">{dateTime(n.created_at)}</span>
                    </span>
                    <Badge variant={n.status === "open" ? "destructive" : "outline"}>
                      {n.status === "open" ? "Açık" : "Kapalı"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* İleriye (hammadde lotu): bu lottan üretilenler — geri çağırma listesi */}
          {trace.usedInLots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">İleriye: Bu Lottan Üretilen Lotlar</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 font-medium">Tarih</th>
                      <th className="px-3 py-2 font-medium">Üretilen lot</th>
                      <th className="px-3 py-2 font-medium">İş emri / Ürün</th>
                      <th className="px-3 py-2 text-right font-medium">Bu lottan tüketilen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trace.usedInLots.map((u, i) => (
                      <tr key={`${u.lotNo}-${i}`} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 tabular-nums">{dateTime(u.createdAt)}</td>
                        <td className="px-3 py-2">
                          {u.lotNo ? (
                            <Link
                              href={`/depo/izlenebilirlik?lot=${encodeURIComponent(u.lotNo)}`}
                              className="font-mono text-xs underline-offset-2 hover:underline"
                            >
                              {u.lotNo}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {u.workOrderNo} · {u.product?.code}
                          <span className="block text-xs text-muted-foreground">
                            {formatTR(u.producedQty, 0)} {u.product?.unit} üretildi
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTR(u.quantity, 2)} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* İleriye: hareketler */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">İleriye: Lotun Stok Hareketleri</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {trace.movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bu lot numarasıyla stok hareketi yok.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 font-medium">Tarih</th>
                      <th className="px-3 py-2 font-medium">Ürün</th>
                      <th className="px-3 py-2 font-medium">Depo</th>
                      <th className="px-3 py-2 font-medium">Hareket</th>
                      <th className="px-3 py-2 text-right font-medium">Miktar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trace.movements.map((m) => (
                      <tr key={m.id} className={cn("border-b border-border last:border-0", m.isReversed && "text-muted-foreground line-through")}>
                        <td className="px-3 py-2 tabular-nums">{dateTime(m.created_at)}</td>
                        <td className="px-3 py-2">{m.product?.code}</td>
                        <td className="px-3 py-2">{m.warehouse?.name}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1">
                            {m.direction === "in" ? (
                              <ArrowDownRight className="h-3.5 w-3.5 text-success" aria-label="Giriş" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5 text-danger" aria-label="Çıkış" />
                            )}
                            {SOURCE_LABELS[m.source_type] ?? m.source_type}
                            {m.document && <span className="text-xs text-muted-foreground">· {m.document.no}</span>}
                            {m.reverses_id && <Badge variant="outline">Ters kayıt</Badge>}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {m.direction === "in" ? "+" : "−"}
                          {formatTR(Number(m.quantity), m.product?.unit === "kg" ? 2 : 0)} {m.product?.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
