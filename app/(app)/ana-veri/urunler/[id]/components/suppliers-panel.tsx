"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addSupplierPrice, removeProductSupplier, saveProductSupplier, type ProductExtras } from "@/app/actions/product-detail/extras";
import { usePermission } from "@/components/shared/role-provider";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatDate, formatTR } from "@/lib/format";
import { cn, getErrorMessage } from "@/lib/utils";

type Supplier = ProductExtras["suppliers"][number];
const CUR = { TRY: "₺", USD: "$", EUR: "€" } as Record<string, string>;
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

function PriceForm({ supplier, onDone }: { supplier: Supplier; onDone: () => void }) {
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState(supplier.lastPrice?.currency ?? "TRY");
  const [validFrom, setValidFrom] = useState(today());
  const [note, setNote] = useState("");
  const [updateCard, setUpdateCard] = useState(supplier.isPrimary);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      try {
        await addSupplierPrice(supplier.id, { price: Number(price.replace(",", ".")), currency: currency as "TRY" | "USD" | "EUR", validFrom, note: note || null, updateCardPrice: updateCard });
        toast.success("Fiyat eklendi", { description: updateCard ? "Ürün kartındaki birim fiyat da güncellendi." : undefined });
        onDone();
      } catch (error) {
        toast.error("Kaydedilemedi", { description: getErrorMessage(error) });
      }
    });

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md bg-muted/40 p-2">
      <Input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Fiyat" className="w-28" aria-label="Fiyat" />
      <div className="w-24">
        <SearchableSelect value={currency} onValueChange={(v) => v && setCurrency(v)} options={["TRY", "USD", "EUR"].map((c) => ({ value: c, label: c }))} placeholder="Döviz" />
      </div>
      <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="w-40" aria-label="Geçerlilik tarihi" />
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Not (ör. teklif no)" className="w-44" />
      <label className="flex items-center gap-1.5 text-xs">
        <Checkbox checked={updateCard} onCheckedChange={(c) => setUpdateCard(Boolean(c))} />
        Kart fiyatını güncelle
      </label>
      <Button size="sm" disabled={pending || price.trim() === ""} onClick={save}>
        {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
        Kaydet
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone}>
        Vazgeç
      </Button>
    </div>
  );
}

function SupplierCard({ s, canWrite }: { s: Supplier; canWrite: boolean }) {
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const remove = () => {
    if (!confirm(`${s.name} bu üründen kaldırılsın mı? Fiyat geçmişi de silinir.`)) return;
    start(async () => {
      try {
        await removeProductSupplier(s.id);
        toast.success("Tedarikçi kaldırıldı");
      } catch (error) {
        toast.error("Kaldırılamadı", { description: getErrorMessage(error) });
      }
    });
  };

  return (
    <div className={cn("space-y-3 rounded-md border border-l-4 p-3", s.isPrimary ? "border-l-primary" : "border-l-border")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            {s.name}
            {s.isPrimary && (
              <Badge>
                <Star className="mr-1 h-3 w-3" aria-hidden />
                Ana tedarikçi
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {[s.supplierCode && `Tedarikçi kodu: ${s.supplierCode}`, s.leadTimeDays !== null && `Teslim: ${s.leadTimeDays} gün`, s.minOrderQty !== null && `Min. sipariş: ${formatTR(s.minOrderQty, 0)}`, s.note]
              .filter(Boolean)
              .join(" · ") || "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Son alış fiyatı</div>
          <div className="text-xl font-semibold tabular-nums text-primary">{s.lastPrice ? `${formatTR(s.lastPrice.price, 2)} ${CUR[s.lastPrice.currency] ?? s.lastPrice.currency}` : "—"}</div>
          {s.lastPrice && <div className="text-xs text-muted-foreground">{formatDate(s.lastPrice.validFrom)}</div>}
        </div>
      </div>

      {s.prices.length > 0 && (
        <div className="max-h-48 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">Tarih</th>
                <th className="px-2 py-1.5 text-right font-medium">Fiyat</th>
                <th className="px-2 py-1.5 text-right font-medium">Değişim</th>
                <th className="px-2 py-1.5 font-medium">Not</th>
              </tr>
            </thead>
            <tbody>
              {s.prices.map((p, i) => {
                const prev = s.prices[i + 1];
                const change = prev && prev.currency === p.currency && prev.price > 0 ? p.price / prev.price - 1 : null;
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 even:bg-muted/30">
                    <td className="px-2 py-1.5">{formatDate(p.validFrom)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatTR(p.price, 2)} {CUR[p.currency] ?? p.currency}
                    </td>
                    <td className={cn("px-2 py-1.5 text-right tabular-nums", change !== null && (change > 0 ? "text-danger" : change < 0 ? "text-success" : ""))}>
                      {change === null ? "—" : `${change > 0 ? "▲ +" : change < 0 ? "▼ " : ""}%${formatTR(change * 100, 1)}`}
                    </td>
                    <td className="max-w-[12rem] truncate px-2 py-1.5 text-xs text-muted-foreground">{p.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canWrite &&
        (adding ? (
          <PriceForm supplier={s} onDone={() => setAdding(false)} />
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Fiyat ekle
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={remove}>
              <Trash2 className="mr-1 h-3.5 w-3.5 text-danger" />
              Kaldır
            </Button>
          </div>
        ))}
    </div>
  );
}

export function SuppliersPanel({ productId, extras }: { productId: string; extras: ProductExtras }) {
  const canWrite = usePermission("master-data:write");
  const [partnerId, setPartnerId] = useState("");
  const [isPrimary, setIsPrimary] = useState(extras.suppliers.length === 0);
  const [code, setCode] = useState("");
  const [lead, setLead] = useState("");
  const [moq, setMoq] = useState("");
  const [pending, start] = useTransition();
  const linked = new Set(extras.suppliers.map((s) => s.partnerId));
  const options = extras.supplierOptions.filter((p) => !linked.has(p.id));

  const add = () =>
    start(async () => {
      try {
        await saveProductSupplier(productId, { partnerId, isPrimary, supplierCode: code || null, leadTimeDays: numOrNull(lead), minOrderQty: numOrNull(moq), note: null });
        toast.success("Tedarikçi eklendi");
        setPartnerId("");
        setCode("");
        setLead("");
        setMoq("");
        setIsPrimary(false);
      } catch (error) {
        toast.error("Eklenemedi", { description: getErrorMessage(error) });
      }
    });

  return (
    <div className="space-y-4">
      {extras.suppliers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bu ürün için tedarikçi tanımlı değil.</p>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {extras.suppliers.map((s) => (
            <SupplierCard key={s.id} s={s} canWrite={canWrite} />
          ))}
        </div>
      )}

      {canWrite && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="w-64 space-y-1">
            <span className="text-xs text-muted-foreground">Tedarikçi</span>
            <SearchableSelect
              value={partnerId}
              onValueChange={setPartnerId}
              options={options.map((p) => ({ value: p.id, label: p.name }))}
              placeholder={options.length ? "Tedarikçi seçin" : "Cariler'de tedarikçi yok"}
            />
          </div>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Tedarikçi ürün kodu" className="w-44" />
          <Input type="number" value={lead} onChange={(e) => setLead(e.target.value)} placeholder="Teslim (gün)" className="w-32" />
          <Input type="number" step="any" value={moq} onChange={(e) => setMoq(e.target.value)} placeholder="Min. sipariş" className="w-32" />
          <label className="flex items-center gap-1.5 text-xs">
            <Checkbox checked={isPrimary} onCheckedChange={(c) => setIsPrimary(Boolean(c))} />
            Ana tedarikçi
          </label>
          <Button disabled={pending || !partnerId} onClick={add}>
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Tedarikçi ekle
          </Button>
        </div>
      )}
    </div>
  );
}
