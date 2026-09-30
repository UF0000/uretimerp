"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { bulkUpdateProducts } from "@/app/actions/master-data/products";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BULK_FIELDS, UNIT_LABELS, type BulkField } from "@/lib/product-bulk";
import { CATEGORY_LABELS, PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from "@/lib/product-meta";
import type { BulkProductUpdate } from "@/lib/validations/master-data";
import { parseTR } from "@/lib/format";
import { cn, getErrorMessage } from "@/lib/utils";

interface BulkUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  groups: { code: string; name: string }[];
  onDone: () => void;
}

type Mode = "set" | "clear";

/** "7,4" ve "7.4" ikisi de 7,4 kabul edilir (binlik ayırıcı bu alanlarda gerekmez) */
const parseNumber = (v: string) => (v.includes(",") ? parseTR(v) : Number(v.trim()));

export function BulkUpdateDialog({ open, onOpenChange, ids, groups, onDone }: BulkUpdateDialogProps) {
  const [field, setField] = useState<BulkField>("category");
  const [mode, setMode] = useState<Mode>("set");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  // Bu pencerede yapılan güncellemeler: pencere açık kalır, sıradaki özelliğe geçilir
  const [done, setDone] = useState<string[]>([]);

  const def = BULK_FIELDS.find((f) => f.field === field) ?? BULK_FIELDS[0];
  const clearing = mode === "clear" && def.clearable;

  const changeField = (f: string) => {
    setField(f as BulkField);
    setMode("set");
    setValue("");
  };

  const options = (): { value: string; label: string }[] => {
    switch (def.kind) {
      case "category":
        return Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v }));
      case "type":
        return PRODUCT_TYPES.map((t) => ({ value: t, label: PRODUCT_TYPE_LABELS[t] }));
      case "unit":
        return Object.entries(UNIT_LABELS).map(([k, v]) => ({ value: k, label: v }));
      case "group":
        return groups.map((g) => ({ value: g.code, label: `${g.code} — ${g.name}` }));
      default:
        return [];
    }
  };

  const submit = async () => {
    let raw: string | number | null = null;
    if (!clearing) {
      if (!value.trim()) {
        toast.error("Atanacak değeri girin.");
        return;
      }
      if (def.kind === "number") {
        raw = parseNumber(value);
        if (!Number.isFinite(raw)) {
          toast.error("Geçerli bir sayı girin.");
          return;
        }
      } else {
        raw = value;
      }
    }
    const verb = clearing ? "temizlenecek" : "değiştirilecek";
    if (!confirm(`Seçili ${ids.length} üründe "${def.label}" ${verb}. Devam edilsin mi?`)) return;
    try {
      setSaving(true);
      const n = await bulkUpdateProducts(ids, { field, value: raw } as BulkProductUpdate);
      toast.success(`${n} ürün güncellendi.`);
      const shown = clearing ? "temizlendi" : (opts.find((o) => o.value === value)?.label ?? value);
      setDone((d) => [...d, `${def.label}: ${shown} (${n} ürün)`]);
      setMode("set");
      setValue("");
      onDone();
    } catch (error) {
      toast.error("Toplu güncelleme başarısız", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const opts = options();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Toplu özellik güncelle</DialogTitle>
          <DialogDescription>Seçili {ids.length} üründe bir özelliği aynı anda değiştirin ya da temizleyin.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Özellik</Label>
            <SearchableSelect value={field} onValueChange={changeField} options={BULK_FIELDS.map((f) => ({ value: f.field, label: f.label }))} />
          </div>

          {def.clearable && (
            <div className="grid grid-cols-2 gap-2">
              {(["set", "clear"] as const).map((m) => (
                <Button key={m} type="button" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)} className={cn(mode !== m && "text-muted-foreground")}>
                  {m === "set" ? "Değer ata" : "Temizle (boşalt)"}
                </Button>
              ))}
            </div>
          )}

          {!clearing && (
            <div className="space-y-2">
              <Label htmlFor="bulk-value">Yeni değer</Label>
              {opts.length > 0 ? (
                <SearchableSelect value={value} onValueChange={setValue} placeholder="Seçin" options={opts} />
              ) : (
                <Input id="bulk-value" value={value} onChange={(e) => setValue(e.target.value)} inputMode={def.kind === "number" ? "decimal" : "text"} placeholder={def.kind === "number" ? "Örn: 7,4" : ""} />
              )}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Yapılan güncellemeler</p>
              {done.map((d, i) => (
                <p key={i} className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  {d}
                </p>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">Başka bir özellik seçip devam edebilir ya da pencereyi kapatabilirsiniz.</p>
            </div>
          )}

          {clearing && field === "variant_code" && (
            <p className="text-xs text-muted-foreground">PP kodlarında genel kod boşaltılınca stok kodundan otomatik yeniden hesaplanır.</p>
          )}
          {clearing && field === "category" && (
            <p className="text-xs text-muted-foreground">01, 24 ve 25 grubundaki ürünlerde aile boşaltılınca otomatik yeniden atanır.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {done.length ? "Kapat" : "Vazgeç"}
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {clearing ? "Temizle" : "Uygula"} ({ids.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
