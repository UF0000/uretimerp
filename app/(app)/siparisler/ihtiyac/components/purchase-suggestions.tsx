"use client";

import { Fragment, useMemo, useState } from "react";
import { FilePlus2, FileSpreadsheet, Info, Loader2, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createDraftsFromSuggestion } from "@/app/actions/purchase";
import { usePermission } from "@/components/shared/role-provider";
import { getErrorMessage } from "@/lib/utils";
import * as xlsx from "xlsx";

import type { PurchaseData } from "@/app/actions/mrp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatTR, parseTR } from "@/lib/format";
import { buildPurchaseSuggestions, type PurchaseRow } from "@/lib/purchase";

const NO_SUPPLIER = "Tedarikçi tanımsız";

const qtyText = (v: number, unit: string) => formatTR(v, unit === "kg" ? 2 : 0);
const trDate = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join(".") : "—");
const addDays = (days: number) => {
  const d = new Date(Date.now() + days * 86400000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
/** "1.250,5" ya da "1250.5" → sayı */
const parseQty = (v: string) => (v.includes(",") ? parseTR(v) : Number(v));

/** Gerekli tarih: en yakın sipariş termini, yoksa bugün + teslim süresi */
const needBy = (r: PurchaseRow) => r.earliestDue ?? (r.supplier?.leadTimeDays ? addDays(r.supplier.leadTimeDays) : null);

export function PurchaseSuggestions({ data }: { data: PurchaseData }) {
  const router = useRouter();
  const canOrder = usePermission("order:write");
  const [creating, setCreating] = useState(false);
  const [topUp, setTopUp] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  // Reçetesi olmayan mamuller varsayılan olarak listede değil (satın alma değil, reçete açılmalı)
  const [excluded, setExcluded] = useState<Set<string>>(
    () => new Set(data.shortages.filter((s) => ["finished", "semi"].includes(data.products[s.productId]?.type ?? "")).map((s) => s.productId)),
  );

  const rows = useMemo(
    () =>
      buildPurchaseSuggestions({
        shortages: data.shortages,
        belowMin: data.belowMin,
        products: new Map(Object.entries(data.products)),
        suppliers: new Map(Object.entries(data.suppliers)),
        topUpToMin: topUp,
      }),
    [data, topUp],
  );

  const qtyOf = (r: PurchaseRow) => {
    const e = edits[r.product.id];
    if (e === undefined) return r.suggestedQty;
    const n = parseQty(e);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const groups = useMemo(() => {
    const m = new Map<string, PurchaseRow[]>();
    for (const r of rows) {
      const k = r.supplier?.partnerName ?? NO_SUPPLIER;
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()];
  }, [rows]);

  const selected = rows.filter((r) => !excluded.has(r.product.id) && qtyOf(r) > 0);

  const toggle = (id: string, on: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (on) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Tutarlar para birimine göre ayrı toplanır */
  const totalsText = (list: PurchaseRow[]) => {
    const t = new Map<string, number>();
    for (const r of list) if (r.supplier?.price) t.set(r.supplier.currency ?? "TRY", (t.get(r.supplier.currency ?? "TRY") ?? 0) + r.supplier.price * qtyOf(r));
    return [...t.entries()].map(([c, v]) => `${formatTR(v)} ${c}`).join(" + ") || "—";
  };

  /** Seçili kalemlerden tedarikçi başına taslak satın alma siparişi */
  const createDrafts = async () => {
    const withSupplier = selected.filter((r) => r.supplier?.partnerId);
    const skipped = selected.length - withSupplier.length;
    if (!withSupplier.length) {
      toast.error("Seçili kalemlerin tedarikçisi tanımlı değil", { description: "Ürün kartı → Tedarikçiler'den ana tedarikçi ekleyin." });
      return;
    }
    const byPartner = new Map<string, PurchaseRow[]>();
    for (const r of withSupplier) byPartner.set(r.supplier!.partnerId, [...(byPartner.get(r.supplier!.partnerId) ?? []), r]);
    const drafts = [...byPartner.entries()].map(([partnerId, list]) => {
      // Para birimi: fiyatı olan ilk kalemin birimi; farklı birimdeki fiyatlar taslağa yazılmaz
      const currency = (list.find((r) => r.supplier?.currency)?.supplier?.currency ?? "TRY") as "TRY" | "USD" | "EUR";
      const due = list.map(needBy).filter((d): d is string => Boolean(d)).sort()[0] ?? null;
      return {
        partner_id: partnerId,
        currency,
        expected_date: due,
        items: list.map((r) => ({ product_id: r.product.id, quantity: qtyOf(r), unit_price: r.supplier?.currency === currency ? r.supplier.price : null })),
      };
    });
    if (!confirm(`${drafts.length} tedarikçi için taslak satın alma siparişi oluşturulsun mu?${skipped ? ` (${skipped} kalemin tedarikçisi yok, atlanacak)` : ""}`)) return;
    try {
      setCreating(true);
      const n = await createDraftsFromSuggestion(drafts);
      toast.success(`${n} taslak satın alma siparişi oluşturuldu.`);
      router.push("/siparisler/satin-alma");
    } catch (error) {
      toast.error("Taslak oluşturulamadı", { description: getErrorMessage(error) });
    } finally {
      setCreating(false);
    }
  };

  const exportExcel = () => {
    const toRow = (r: PurchaseRow) => {
      const q = qtyOf(r);
      return {
        Tedarikçi: r.supplier?.partnerName ?? NO_SUPPLIER,
        "Tedarikçi ürün kodu": r.supplier?.supplierCode ?? "",
        "Stok kodu": r.product.code,
        "Ürün adı": r.product.name,
        Birim: r.product.unit,
        Miktar: q,
        "Birim fiyat": r.supplier?.price ?? "",
        "Para birimi": r.supplier?.currency ?? "",
        Tutar: r.supplier?.price ? Math.round(r.supplier.price * q * 100) / 100 : "",
        "Gerekli tarih": trDate(needBy(r)),
        Neden: r.reason === "ihtiyac" ? "Sipariş / üretim ihtiyacı" : r.reason === "recetesiz" ? "Mamul, reçetesi yok" : "Minimum stok altı",
      };
    };
    const book = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet(selected.map(toRow)), "Tümü");
    // Tedarikçiye gönderilecek ayrı sayfalar
    const used = new Set<string>(["Tümü"]);
    for (const [name, list] of groups) {
      const chosen = list.filter((r) => selected.includes(r));
      if (!chosen.length) continue;
      let sheet = name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Tedarikçi";
      for (let i = 2; used.has(sheet); i++) sheet = `${sheet.slice(0, 28)} ${i}`;
      used.add(sheet);
      xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet(chosen.map(toRow)), sheet);
    }
    xlsx.writeFile(book, `satin-alma-onerisi-${addDays(0)}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingBag className="h-4 w-4" aria-hidden />
          Satın Alma Önerisi
        </CardTitle>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={topUp} onCheckedChange={setTopUp} />
            Minimum stoğa tamamla
          </label>
          <Button variant="outline" onClick={exportExcel} disabled={selected.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel&apos;e aktar ({selected.length})
          </Button>
          {canOrder && (
            <Button onClick={createDrafts} disabled={selected.length === 0 || creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}
              Taslak sipariş oluştur
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Satın alınması gereken malzeme yok: net ihtiyaçta eksik yok ve hiçbir hammadde / ticari mal minimum stoğun altında değil.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="w-8 px-2 py-2" />
                  <th className="px-3 py-2 font-medium">Malzeme</th>
                  <th className="px-3 py-2 font-medium">Neden</th>
                  <th className="px-3 py-2 text-right font-medium">Stok</th>
                  <th className="px-3 py-2 text-right font-medium">Net eksik</th>
                  <th className="px-3 py-2 text-right font-medium">Sipariş miktarı</th>
                  <th className="px-3 py-2 text-right font-medium">Birim fiyat</th>
                  <th className="px-3 py-2 text-right font-medium">Tutar</th>
                  <th className="px-3 py-2 font-medium">Gerekli tarih</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([name, list]) => (
                  <Fragment key={name}>
                    <tr className="border-b border-border bg-muted/40">
                      <td colSpan={7} className="px-3 py-2 font-semibold">
                        {name} <span className="font-normal text-muted-foreground">· {list.length} kalem</span>
                      </td>
                      <td colSpan={2} className="px-3 py-2 text-right font-semibold tabular-nums">
                        {totalsText(list.filter((r) => selected.includes(r)))}
                      </td>
                    </tr>
                    {list.map((r) => {
                      const on = !excluded.has(r.product.id);
                      const q = qtyOf(r);
                      return (
                        <tr key={r.product.id} className={on ? "border-b border-border" : "border-b border-border text-muted-foreground"}>
                          <td className="px-2 py-2">
                            <Checkbox checked={on} onCheckedChange={(v) => toggle(r.product.id, Boolean(v))} aria-label={`${r.product.code} listeye dahil`} />
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{r.product.code}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.product.name}
                              {r.supplier?.supplierCode ? ` · tedarikçi kodu ${r.supplier.supplierCode}` : ""}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={r.reason === "ihtiyac" ? "destructive" : r.reason === "recetesiz" ? "secondary" : "outline"} title={r.reason === "recetesiz" ? "Mamul ama reçetesi yok: üretilecekse reçete açın; dışarıdan alınıyorsa listeye dahil edin" : undefined}>
                              {r.reason === "ihtiyac" ? "İhtiyaç" : r.reason === "recetesiz" ? "Reçete yok" : "Minimum altı"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {qtyText(r.stock, r.product.unit)} {r.product.unit}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.net > 0 ? `${qtyText(r.net, r.product.unit)} ${r.product.unit}` : "—"}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                value={edits[r.product.id] ?? qtyText(r.suggestedQty, r.product.unit)}
                                onChange={(e) => setEdits((prev) => ({ ...prev, [r.product.id]: e.target.value }))}
                                inputMode="decimal"
                                aria-label={`${r.product.code} sipariş miktarı`}
                                className="h-8 w-28 text-right tabular-nums"
                              />
                              <span className="w-10 text-xs text-muted-foreground">{r.product.unit}</span>
                            </div>
                            {r.supplier?.minOrderQty ? <div className="text-right text-xs text-muted-foreground">en az {qtyText(r.supplier.minOrderQty, r.product.unit)}</div> : null}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.supplier?.price ? `${formatTR(r.supplier.price)} ${r.supplier.currency ?? ""}` : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.supplier?.price ? `${formatTR(r.supplier.price * q)} ${r.supplier.currency ?? ""}` : "—"}</td>
                          <td className="px-3 py-2 tabular-nums">{trDate(needBy(r))}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Öneri: net eksik (+ açıksa minimum stok) ya da minimum stok − mevcut stok; tedarikçinin en az sipariş miktarına yuvarlanır. Tedarikçi ve fiyat ürün kartındaki
          ana tedarikçiden gelir (Ürün kartı → Tedarikçiler). Miktarları düzenleyip Excel&apos;e aktarın; Excel&apos;de her tedarikçi ayrı sayfadadır.
        </p>
      </CardContent>
    </Card>
  );
}
