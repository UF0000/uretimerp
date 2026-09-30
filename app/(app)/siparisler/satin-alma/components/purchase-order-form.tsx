"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { savePurchaseOrder, type PurchaseFormData } from "@/app/actions/purchase";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatTR, parseTR } from "@/lib/format";
import { getErrorMessage } from "@/lib/utils";

type Currency = "TRY" | "USD" | "EUR";

export interface PurchaseOrderFormInitial {
  id: string;
  partner_id: string;
  order_date: string;
  expected_date: string | null;
  currency: string;
  note: string | null;
  items: { product_id: string; quantity: number; unit_price: number | null; note: string | null }[];
}

interface Line {
  key: string;
  product_id: string;
  quantity: string;
  unit_price: string;
  note: string;
}

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const newKey = () => Math.random().toString(36).slice(2, 9);
/** "1.250,5" ya da "1250.5" → sayı; boş → null */
const num = (v: string) => (v.trim() === "" ? null : v.includes(",") ? parseTR(v) : Number(v));
const emptyLine = (): Line => ({ key: newKey(), product_id: "", quantity: "", unit_price: "", note: "" });

export function PurchaseOrderForm({ data, initial }: { data: PurchaseFormData; initial?: PurchaseOrderFormInitial }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [partnerId, setPartnerId] = useState(initial?.partner_id ?? "");
  const [orderDate, setOrderDate] = useState(initial?.order_date ?? today());
  const [expectedDate, setExpectedDate] = useState(initial?.expected_date ?? "");
  const [currency, setCurrency] = useState<Currency>((initial?.currency as Currency) ?? "TRY");
  const [note, setNote] = useState(initial?.note ?? "");
  const [lines, setLines] = useState<Line[]>(
    initial?.items.length
      ? initial.items.map((i) => ({ key: newKey(), product_id: i.product_id, quantity: String(i.quantity).replace(".", ","), unit_price: i.unit_price !== null ? String(i.unit_price).replace(".", ",") : "", note: i.note ?? "" }))
      : [emptyLine()],
  );

  const productOptions = data.products.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));
  const unitOf = (id: string) => data.products.find((p) => p.id === id)?.unit ?? "";

  const setLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Ürün seçilince tedarikçinin kayıtlı fiyatı gelir. Henüz fiyatlı kalem yoksa para birimi de fiyatınkine geçer;
  // farklı para biriminde fiyatlı kalem varsa fiyat yazılmaz (karışık para birimi olmasın)
  const pickProduct = (key: string, productId: string) => {
    const p = data.prices[`${partnerId}|${productId}`];
    const noPricedLine = lines.every((l) => l.key === key || !l.unit_price.trim());
    const usable = p && (p.currency === currency || (noPricedLine && ["TRY", "USD", "EUR"].includes(p.currency)));
    if (usable && p.currency !== currency) setCurrency(p.currency as Currency);
    setLine(key, { product_id: productId, ...(usable ? { unit_price: String(p.price).replace(".", ",") } : {}) });
  };

  const total = lines.reduce((s, l) => s + (num(l.quantity) ?? 0) * (num(l.unit_price) ?? 0), 0);

  const submit = async () => {
    const items = lines
      .filter((l) => l.product_id || l.quantity)
      .map((l) => ({ product_id: l.product_id, quantity: num(l.quantity) ?? 0, unit_price: num(l.unit_price), note: l.note || null }));
    if (items.some((i) => !Number.isFinite(i.quantity) || (i.unit_price !== null && !Number.isFinite(i.unit_price)))) {
      toast.error("Miktar ve fiyat için geçerli sayı girin.");
      return;
    }
    try {
      setSaving(true);
      const id = await savePurchaseOrder({ id: initial?.id, partner_id: partnerId, order_date: orderDate, expected_date: expectedDate || null, currency, note: note || null, items });
      toast.success(initial ? "Taslak sipariş güncellendi" : "Taslak sipariş oluşturuldu");
      router.push(`/siparisler/satin-alma/${id}`);
      router.refresh();
    } catch (error) {
      toast.error("Sipariş kaydedilemedi", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sipariş bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-1 md:col-span-2">
            <Label>Tedarikçi *</Label>
            <SearchableSelect value={partnerId} onValueChange={setPartnerId} placeholder="Tedarikçi seçin" options={data.suppliers.map((s) => ({ value: s.id, label: s.name }))} />
            {data.suppliers.length === 0 && <p className="text-xs text-warning">Tanımlı tedarikçi yok: Ana Veri → Cariler&apos;den tür &quot;Tedarikçi&quot; olan cari ekleyin.</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="po-date">Sipariş tarihi</Label>
            <Input id="po-date" type="date" value={orderDate} onChange={(e) => e.target.value && setOrderDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="po-expected">Beklenen teslim</Label>
            <Input id="po-expected" type="date" value={expectedDate} min={orderDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Para birimi</Label>
            <SearchableSelect value={currency} onValueChange={(v) => v && setCurrency(v as Currency)} options={["TRY", "USD", "EUR"].map((c) => ({ value: c, label: c }))} />
          </div>
          <div className="space-y-1 md:col-span-3">
            <Label htmlFor="po-note">Not</Label>
            <Textarea id="po-note" rows={1} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Kalemler</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
            <Plus className="mr-1.5 h-4 w-4" />
            Kalem ekle
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((l) => (
            <div key={l.key} className="grid grid-cols-2 items-end gap-2 border-b border-border pb-3 last:border-0 md:grid-cols-[1fr_140px_140px_160px_40px]">
              <div className="col-span-2 space-y-1 md:col-span-1">
                <Label className="text-xs">Ürün</Label>
                <SearchableSelect value={l.product_id} onValueChange={(v) => pickProduct(l.key, v)} placeholder="Ürün seçin" options={productOptions} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Miktar {unitOf(l.product_id) && `(${unitOf(l.product_id)})`}</Label>
                <Input value={l.quantity} inputMode="decimal" onChange={(e) => setLine(l.key, { quantity: e.target.value })} className="text-right tabular-nums" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Birim fiyat ({currency})</Label>
                <Input value={l.unit_price} inputMode="decimal" onChange={(e) => setLine(l.key, { unit_price: e.target.value })} className="text-right tabular-nums" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tutar</Label>
                <p className="h-9 py-2 text-right tabular-nums">{formatTR((num(l.quantity) ?? 0) * (num(l.unit_price) ?? 0))} {currency}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [emptyLine()]))} aria-label="Kalemi sil">
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground">Toplam</span>
            <span className="text-lg font-semibold tabular-nums">
              {formatTR(total)} {currency}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          Vazgeç
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Taslak olarak kaydet
        </Button>
      </div>
    </div>
  );
}
