"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Loader2, PackageCheck, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deletePurchaseOrder, receivePurchaseOrder, setPurchaseOrderStatus } from "@/app/actions/purchase";
import { usePermission } from "@/components/shared/role-provider";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTR, parseTR } from "@/lib/format";
import { getErrorMessage } from "@/lib/utils";

interface ReceiptItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  remaining: number;
}

interface PurchaseOrderActionsProps {
  id: string;
  no: string;
  status: string;
  items: ReceiptItem[];
  warehouses: { id: string; name: string; type: string }[];
}

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const num = (v: string) => (v.trim() === "" ? 0 : v.includes(",") ? parseTR(v) : Number(v));
const qtyText = (v: number, unit: string) => formatTR(v, unit === "kg" ? 2 : 0);

export function PurchaseOrderActions({ id, no, status, items, warehouses }: PurchaseOrderActionsProps) {
  const router = useRouter();
  const canOrder = usePermission("order:write");
  const canReceive = usePermission("stock:write");
  const [busy, setBusy] = useState(false);
  const [receiving, setReceiving] = useState(false);

  const run = async (label: string, fn: () => Promise<unknown>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    try {
      setBusy(true);
      await fn();
      toast.success(label);
      router.refresh();
    } catch (error) {
      toast.error("İşlem yapılamadı", { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && canOrder && (
        <>
          <Button disabled={busy} onClick={() => run("Sipariş verildi olarak işaretlendi", () => setPurchaseOrderStatus(id, "ordered"), `${no} tedarikçiye verildi olarak işaretlensin mi? Sonra kalemler değiştirilemez.`)}>
            <Send className="mr-2 h-4 w-4" />
            Sipariş verildi
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(
                "Taslak silindi",
                async () => {
                  await deletePurchaseOrder(id);
                  router.push("/siparisler/satin-alma");
                },
                `${no} taslağı silinsin mi?`,
              )
            }
          >
            <Trash2 className="mr-2 h-4 w-4 text-danger" />
            Taslağı sil
          </Button>
        </>
      )}
      {status === "ordered" && canReceive && (
        <Button disabled={busy} onClick={() => setReceiving(true)}>
          <PackageCheck className="mr-2 h-4 w-4" />
          Teslim al
        </Button>
      )}
      {status === "ordered" && canOrder && (
        <Button variant="outline" disabled={busy} onClick={() => run("Sipariş kapatıldı", () => setPurchaseOrderStatus(id, "closed"), `${no} kapatılsın mı? Kalan miktarlar artık beklenmeyecek.`)}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Kapat (kalanı bekleme)
        </Button>
      )}
      {(status === "draft" || status === "ordered") && canOrder && (
        <Button variant="outline" disabled={busy} onClick={() => run("Sipariş iptal edildi", () => setPurchaseOrderStatus(id, "cancelled"), `${no} iptal edilsin mi?`)}>
          <Ban className="mr-2 h-4 w-4 text-danger" />
          İptal et
        </Button>
      )}
      {receiving && <ReceiptDialog id={id} no={no} items={items} warehouses={warehouses} onClose={() => setReceiving(false)} onDone={() => router.refresh()} />}
    </div>
  );
}

function ReceiptDialog({ id, no, items, warehouses, onClose, onDone }: { id: string; no: string; items: ReceiptItem[]; warehouses: { id: string; name: string; type: string }[]; onClose: () => void; onDone: () => void }) {
  // Hammadde deposu önce
  const usable = [...warehouses.filter((w) => w.type === "raw"), ...warehouses.filter((w) => !["raw", "scrap", "quarantine", "regrind"].includes(w.type))];
  const [warehouseId, setWarehouseId] = useState(usable[0]?.id ?? "");
  const [date, setDate] = useState(today());
  const open = items.filter((i) => i.remaining > 0);
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(open.map((i) => [i.id, qtyText(i.remaining, i.unit).replace(/\./g, "")])));
  const [lots, setLots] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const lines = open.map((i) => ({ item_id: i.id, qty: num(qty[i.id] ?? ""), lot_no: lots[i.id] || null }));
    if (lines.some((l) => !Number.isFinite(l.qty) || l.qty < 0)) return toast.error("Geçerli miktar girin.");
    if (!lines.some((l) => l.qty > 0)) return toast.error("Teslim alınacak miktar girin.");
    const over = open.find((i) => num(qty[i.id] ?? "") > i.remaining * 1.1);
    if (over && !confirm(`${over.code} için kalan miktarın %10'undan fazlası giriliyor. Devam edilsin mi?`)) return;
    try {
      setSaving(true);
      await receivePurchaseOrder({ purchase_order_id: id, warehouse_id: warehouseId, date, lines, note: null });
      toast.success("Teslim alındı; stok girişi yapıldı.");
      onDone();
      onClose();
    } catch (error) {
      toast.error("Teslim alınamadı", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Teslim al — {no}</DialogTitle>
          <DialogDescription>Gelen miktarları girin; stok girişi seçilen depoya satın alma fişiyle yapılır. Lot boş bırakılırsa sipariş numarası lot olur.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Depo</Label>
            <SearchableSelect value={warehouseId} onValueChange={setWarehouseId} options={usable.map((w) => ({ value: w.id, label: w.name }))} placeholder="Depo seçin" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rc-date">Teslim tarihi</Label>
            <Input id="rc-date" type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          {open.map((i) => (
            <div key={i.id} className="grid grid-cols-2 items-end gap-2 rounded border border-border p-2 sm:grid-cols-[1fr_140px_140px]">
              <div className="col-span-2 sm:col-span-1">
                <p className="font-medium">{i.code}</p>
                <p className="text-xs text-muted-foreground">
                  {i.name} · kalan {qtyText(i.remaining, i.unit)} {i.unit}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gelen ({i.unit})</Label>
                <Input value={qty[i.id] ?? ""} inputMode="decimal" onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value }))} className="text-right tabular-nums" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lot / parti no</Label>
                <Input value={lots[i.id] ?? ""} placeholder={no} onChange={(e) => setLots((l) => ({ ...l, [i.id]: e.target.value }))} />
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={submit} disabled={saving || !warehouseId}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
            Teslim al ve stoğa gir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
