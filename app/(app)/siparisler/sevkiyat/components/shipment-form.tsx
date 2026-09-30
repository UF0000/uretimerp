"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";

import { createShipment, type ShipmentFormData } from "@/app/actions/shipments";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatTR, parseTR } from "@/lib/format";
import { getErrorMessage, one } from "@/lib/utils";

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const num = (v: string) => (v.trim() === "" ? 0 : v.includes(",") ? parseTR(v) : Number(v));
const qtyText = (v: number, unit: string) => formatTR(v, unit === "kg" ? 2 : 0);
/** Sevk kutusuna yazılacak metin (binlik ayraç yok) */
const qtyInput = (v: number, unit: string) => qtyText(v, unit).replace(/\./g, "");
const NO_LOT = "__lotsuz__";

export function ShipmentForm({ data }: { data: ShipmentFormData }) {
  const router = useRouter();
  const partner = one(data.order.partner);
  const items = (data.order.items ?? []).map((i) => ({ ...i, product: one(i.product), remaining: Math.max(0, Number(i.quantity) - Number(i.delivered_qty ?? 0)) }));

  // Mamul deposu önce; karantina / hurda / kırma sevk edilmez
  const warehouses = [...data.warehouses.filter((w) => w.type === "finished"), ...data.warehouses.filter((w) => !["finished", "quarantine", "scrap", "regrind"].includes(w.type))];
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [date, setDate] = useState(today());
  const [address, setAddress] = useState(partner?.address ?? "");
  const [vehicle, setVehicle] = useState("");
  const [driver, setDriver] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const stockIn = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data.stock) if (s.warehouse_id === warehouseId && s.product_id) m.set(s.product_id, (m.get(s.product_id) ?? 0) + Number(s.qty ?? 0));
    return m;
  }, [data.stock, warehouseId]);
  const lotsOf = (productId: string) => data.lots.filter((l) => l.product_id === productId && l.warehouse_id === warehouseId && l.lot_no);

  // Varsayılan sevk miktarı: kalan ile depodaki stoktan küçüğü
  const defaultQty = (i: (typeof items)[number]) => qtyInput(Math.max(0, Math.min(i.remaining, stockIn.get(i.product_id) ?? 0)), i.product?.unit ?? "");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [lots, setLots] = useState<Record<string, string>>({});
  const qtyOf = (i: (typeof items)[number]) => qty[i.id] ?? defaultQty(i);

  const submit = async () => {
    const lines = items.filter((i) => i.remaining > 0).map((i) => ({ item_id: i.id, qty: num(qtyOf(i)), lot_no: lots[i.id] && lots[i.id] !== NO_LOT ? lots[i.id] : null }));
    if (lines.some((l) => !Number.isFinite(l.qty) || l.qty < 0)) return toast.error("Geçerli miktar girin.");
    if (!lines.some((l) => l.qty > 0)) return toast.error("Sevk edilecek miktar girin.");
    const over = items.find((i) => num(qtyOf(i)) > i.remaining);
    if (over && !confirm(`${over.product?.code} için sipariş kalanından fazla sevk ediliyor. Devam edilsin mi?`)) return;
    try {
      setSaving(true);
      const id = await createShipment({ order_id: data.order.id, warehouse_id: warehouseId, date, address, vehicle, driver, note, lines });
      toast.success("Sevkiyat kaydedildi; stoktan düşüldü.");
      router.push(`/siparisler/sevkiyat/${id}`);
    } catch (error) {
      toast.error("Sevk edilemedi", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sevk bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Çıkış deposu *</Label>
            <SearchableSelect value={warehouseId} onValueChange={(v) => { setWarehouseId(v); setQty({}); setLots({}); }} options={warehouses.map((w) => ({ value: w.id, label: w.name }))} placeholder="Depo seçin" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sh-date">Sevk tarihi</Label>
            <Input id="sh-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sh-plate">Araç plakası</Label>
            <Input id="sh-plate" value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} placeholder="34 ABC 123" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sh-driver">Şoför</Label>
            <Input id="sh-driver" value={driver} onChange={(e) => setDriver(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="sh-address">Teslim adresi</Label>
            <Textarea id="sh-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="sh-note">Not</Label>
            <Textarea id="sh-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sevk edilecek kalemler</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">Ürün</th>
                <th className="px-3 py-2 text-right font-medium">Sipariş</th>
                <th className="px-3 py-2 text-right font-medium">Sevk edilen</th>
                <th className="px-3 py-2 text-right font-medium">Kalan</th>
                <th className="px-3 py-2 text-right font-medium">Depodaki stok</th>
                <th className="px-3 py-2 font-medium">Lot</th>
                <th className="px-3 py-2 text-right font-medium">Sevk miktarı</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const unit = i.product?.unit ?? "";
                const stock = stockIn.get(i.product_id) ?? 0;
                const lotOptions = lotsOf(i.product_id);
                const done = i.remaining <= 0;
                return (
                  <tr key={i.id} className={done ? "border-b border-border text-muted-foreground last:border-0" : "border-b border-border last:border-0"}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{i.product?.code}</div>
                      <div className="text-xs text-muted-foreground">{i.product?.name}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{qtyText(Number(i.quantity), unit)} {unit}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{qtyText(Number(i.delivered_qty ?? 0), unit)} {unit}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{qtyText(i.remaining, unit)} {unit}</td>
                    <td className={stock < i.remaining ? "px-3 py-2 text-right tabular-nums text-warning" : "px-3 py-2 text-right tabular-nums"}>{qtyText(stock, unit)} {unit}</td>
                    <td className="min-w-40 px-3 py-2">
                      {done ? (
                        "—"
                      ) : (
                        <SearchableSelect
                          value={lots[i.id] ?? NO_LOT}
                          onValueChange={(v) => setLots((l) => ({ ...l, [i.id]: v }))}
                          options={[{ value: NO_LOT, label: "Lot seçmeden" }, ...lotOptions.map((l) => ({ value: l.lot_no ?? "", label: `${l.lot_no} (${qtyText(Number(l.qty), unit)} ${unit})` }))]}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {done ? (
                        <span className="block text-right">Tamamlandı</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Input value={qtyOf(i)} inputMode="decimal" onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value }))} aria-label={`${i.product?.code} sevk miktarı`} className="h-8 w-28 text-right tabular-nums" />
                          <span className="w-10 text-xs text-muted-foreground">{unit}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">Depoda yeterli stok yoksa sevkiyat kaydedilmez. Lot seçilirse o lottan düşülür ve izlenebilirlikte müşteriye kadar takip edilir.</p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          Vazgeç
        </Button>
        <Button onClick={submit} disabled={saving || !warehouseId}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
          Sevk et ve irsaliye oluştur
        </Button>
      </div>
    </div>
  );
}
