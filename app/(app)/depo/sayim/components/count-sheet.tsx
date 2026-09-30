"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Loader2, Plus, Printer, Search } from "lucide-react";
import { toast } from "sonner";

import { addCountLine, cancelStockCount, completeStockCount, saveCountedQty, type StockCountDetail } from "@/app/actions/stock-counts";
import { usePermission } from "@/components/shared/role-provider";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatTR, parseTR } from "@/lib/format";
import { matchesTokens, searchTokens } from "@/lib/search";
import { cn, getErrorMessage } from "@/lib/utils";

type Line = StockCountDetail["lines"][number];
type Filter = "all" | "uncounted" | "diff";

const qtyText = (v: number, unit: string) => formatTR(v, unit === "kg" ? 3 : 0);
const toInput = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));
/** "1.250,5" ya da "1250.5" → sayı; boş → null */
const parse = (v: string) => (v.trim() === "" ? null : v.includes(",") ? parseTR(v) : Number(v));

interface CountSheetProps {
  data: StockCountDetail;
  products: { id: string; code: string; name: string }[];
}

export function CountSheet({ data, products }: CountSheetProps) {
  const router = useRouter();
  const canWrite = usePermission("stock:write");
  const { count } = data;
  const open = count.status === "open" && canWrite;

  // Girilen değerler yerelde tutulur, kutudan çıkınca kaydedilir
  const [values, setValues] = useState<Record<string, string>>({});
  const [savedQty, setSavedQty] = useState<Record<string, number | null>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [blind, setBlind] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const countedOf = (l: Line) => (l.id in savedQty ? savedQty[l.id] : l.counted_qty !== null ? Number(l.counted_qty) : null);
  const diffOf = (l: Line) => {
    const c = countedOf(l);
    return c === null ? null : c - Number(l.system_qty);
  };

  const lines = useMemo(() => {
    const tokens = searchTokens(q);
    return data.lines.filter((l) => {
      if (!matchesTokens(tokens, l.product?.code, l.product?.name, l.lot_no)) return false;
      if (filter === "uncounted") return countedOf(l) === null;
      if (filter === "diff") return (diffOf(l) ?? 0) !== 0;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.lines, q, filter, savedQty]);

  const countedCount = data.lines.filter((l) => countedOf(l) !== null).length;
  const diffCount = data.lines.filter((l) => (diffOf(l) ?? 0) !== 0).length;

  const save = async (l: Line) => {
    const raw = values[l.id];
    if (raw === undefined) return;
    const qty = parse(raw);
    if (qty !== null && (!Number.isFinite(qty) || qty < 0)) {
      toast.error(`${l.product?.code}: geçerli bir miktar girin.`);
      return;
    }
    if (qty === countedOf(l)) return;
    try {
      setSavingId(l.id);
      await saveCountedQty(l.id, qty);
      setSavedQty((s) => ({ ...s, [l.id]: qty }));
    } catch (error) {
      toast.error("Kaydedilemedi", { description: getErrorMessage(error) });
    } finally {
      setSavingId(null);
    }
  };

  const complete = async () => {
    const uncounted = data.lines.length - countedCount;
    const msg = `${count.no} tamamlansın mı?\n\n${countedCount} kalem sayıldı${uncounted ? `, ${uncounted} kalem sayılmadı (bunlara dokunulmaz)` : ""}.\nFarklar, tamamlama anındaki stokla karşılaştırılıp sayım fazlası / eksiği fişiyle stoğa işlenir.`;
    if (!confirm(msg)) return;
    try {
      setBusy(true);
      const r = await completeStockCount(count.id);
      toast.success(`Sayım tamamlandı: ${r.fazla} kalem fazla, ${r.eksik} kalem eksik stoğa işlendi.`);
      router.refresh();
    } catch (error) {
      toast.error("Tamamlanamadı", { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirm(`${count.no} iptal edilsin mi? Stoğa hiçbir şey işlenmez.`)) return;
    try {
      setBusy(true);
      await cancelStockCount(count.id);
      toast.success("Sayım iptal edildi.");
      router.refresh();
    } catch (error) {
      toast.error("İptal edilemedi", { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Araç çubuğu */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kod, ad, lot ara" className="pl-9" />
        </div>
        <SearchableSelect
          value={filter}
          onValueChange={(v) => setFilter((v || "all") as Filter)}
          options={[
            { value: "all", label: `Tümü (${data.lines.length})` },
            { value: "uncounted", label: `Sayılmayanlar (${data.lines.length - countedCount})` },
            { value: "diff", label: `Fark çıkanlar (${diffCount})` },
          ]}
          className="w-48"
        />
        {count.status === "open" && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={blind} onCheckedChange={setBlind} />
            Kör sayım (sistem miktarını gizle)
          </label>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Sayım listesini yazdır
          </Button>
          {open && (
            <>
              <Button variant="outline" onClick={() => setAdding(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Kalem ekle
              </Button>
              <Button variant="outline" onClick={cancel} disabled={busy}>
                <Ban className="mr-2 h-4 w-4 text-danger" />
                İptal et
              </Button>
              <Button onClick={complete} disabled={busy || countedCount === 0}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Sayımı tamamla
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground print:hidden">
        {countedCount} / {data.lines.length} kalem sayıldı{count.status === "open" ? " · miktar kutudan çıkınca kaydedilir" : ""}
        {count.status === "completed" && (
          <>
            {" · "}
            {count.in_document_id && (
              <Link href={`/depo/fisler/${count.in_document_id}`} className="text-primary underline-offset-2 hover:underline">
                Sayım fazlası fişi {count.inDoc?.no}
              </Link>
            )}
            {count.in_document_id && count.out_document_id && " · "}
            {count.out_document_id && (
              <Link href={`/depo/fisler/${count.out_document_id}`} className="text-primary underline-offset-2 hover:underline">
                Sayım eksiği fişi {count.outDoc?.no}
              </Link>
            )}
            {!count.in_document_id && !count.out_document_id && "fark çıkmadı"}
          </>
        )}
      </div>

      {/* Sayım tablosu (yazdırmada da kullanılır) */}
      <div className="overflow-x-auto rounded-md border border-border bg-card print:overflow-visible print:border-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground print:bg-transparent print:text-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Stok kodu</th>
              <th className="px-3 py-2 font-medium">Ürün adı</th>
              <th className="px-3 py-2 font-medium">Lot</th>
              <th className={cn("px-3 py-2 text-right font-medium", blind && "hidden")}>Sistem</th>
              <th className="px-3 py-2 text-right font-medium">Sayılan</th>
              <th className={cn("px-3 py-2 text-right font-medium", blind && "hidden", "print:hidden")}>Fark</th>
              {count.status === "completed" && <th className="px-3 py-2 text-right font-medium">İşlenen</th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const unit = l.product?.unit ?? "";
              const counted = countedOf(l);
              const diff = diffOf(l);
              return (
                <tr key={l.id} className="border-b border-border last:border-0 print:break-inside-avoid">
                  <td className="px-3 py-1.5 font-medium">
                    {l.product?.code}
                    {l.added_manually && <span className="ml-1 text-xs text-muted-foreground">(eklendi)</span>}
                  </td>
                  <td className="px-3 py-1.5">{l.product?.name}</td>
                  <td className="px-3 py-1.5">{l.lot_no ?? "—"}</td>
                  <td className={cn("px-3 py-1.5 text-right tabular-nums", blind && "hidden")}>
                    {qtyText(Number(l.system_qty), unit)} {unit}
                  </td>
                  <td className="px-3 py-1.5">
                    {open ? (
                      <div className="flex items-center justify-end gap-1 print:hidden">
                        <Input
                          value={values[l.id] ?? toInput(counted)}
                          onChange={(e) => setValues((v) => ({ ...v, [l.id]: e.target.value }))}
                          onBlur={() => save(l)}
                          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                          inputMode="decimal"
                          aria-label={`${l.product?.code} sayılan miktar`}
                          className={cn("h-8 w-28 text-right tabular-nums", counted !== null && "border-success/60")}
                        />
                        <span className="w-8 text-xs text-muted-foreground">{savingId === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : unit}</span>
                      </div>
                    ) : null}
                    {/* Yazdırmada ve kapalı sayımda: değer ya da boş yazma alanı */}
                    <span className={cn("block text-right tabular-nums", open && "hidden print:block")}>{counted !== null ? `${qtyText(counted, unit)} ${unit}` : "____________"}</span>
                  </td>
                  <td className={cn("px-3 py-1.5 text-right font-medium tabular-nums", blind && "hidden", "print:hidden", diff !== null && diff > 0 && "text-success", diff !== null && diff < 0 && "text-danger")}>
                    {diff === null ? "—" : `${diff > 0 ? "+" : ""}${qtyText(diff, unit)}`}
                  </td>
                  {count.status === "completed" && (
                    <td className="px-3 py-1.5 text-right tabular-nums">{l.adjusted_qty === null ? "—" : `${Number(l.adjusted_qty) > 0 ? "+" : ""}${qtyText(Number(l.adjusted_qty), unit)}`}</td>
                  )}
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Kayıt yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {adding && <AddLineDialog countId={count.id} products={products} onClose={() => setAdding(false)} onAdded={() => router.refresh()} />}
    </div>
  );
}

function AddLineDialog({ countId, products, onClose, onAdded }: { countId: string; products: { id: string; code: string; name: string }[]; onClose: () => void; onAdded: () => void }) {
  const [productId, setProductId] = useState("");
  const [lot, setLot] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!productId) return toast.error("Ürün seçin.");
    try {
      setSaving(true);
      await addCountLine(countId, productId, lot || null);
      toast.success("Kalem eklendi; sayılan miktarı girin.");
      onAdded();
      onClose();
    } catch (error) {
      toast.error("Eklenemedi", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Sayıma kalem ekle</DialogTitle>
          <DialogDescription>Listede olmayan ama depoda bulunan ürün / lot için.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Ürün</Label>
            <SearchableSelect value={productId} onValueChange={setProductId} placeholder="Ürün seçin" options={products.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-lot">Lot (varsa)</Label>
            <Input id="add-lot" value={lot} onChange={(e) => setLot(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
