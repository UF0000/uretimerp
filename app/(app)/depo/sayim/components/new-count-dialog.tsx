"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createStockCount } from "@/app/actions/stock-counts";
import { MultiSelect } from "@/components/shared/multi-select";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABELS, PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from "@/lib/product-meta";
import { getErrorMessage } from "@/lib/utils";

interface NewCountDialogProps {
  warehouses: { id: string; name: string }[];
  groups: { code: string; name: string }[];
}

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export function NewCountDialog({ warehouses, groups }: NewCountDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [date, setDate] = useState(today());
  const [types, setTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [groupCodes, setGroupCodes] = useState<string[]>([]);
  const [includeZero, setIncludeZero] = useState(false);
  const [note, setNote] = useState("");

  const submit = async () => {
    try {
      setSaving(true);
      const id = await createStockCount({ warehouse_id: warehouseId, count_date: date, types, categories, group_codes: groupCodes, include_zero: includeZero, note: note || null });
      toast.success("Sayım listesi oluşturuldu.");
      setOpen(false);
      router.push(`/depo/sayim/${id}`);
    } catch (error) {
      toast.error("Sayım oluşturulamadı", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <ClipboardList className="mr-2 h-4 w-4" />
        Yeni sayım
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Yeni stok sayımı</DialogTitle>
            <DialogDescription>Seçilen depodaki stok lot bazında sayım listesine alınır. Listeyi tür, aile ya da grup koduyla daraltabilirsiniz (boş = hepsi).</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Depo *</Label>
              <SearchableSelect value={warehouseId} onValueChange={setWarehouseId} options={warehouses.map((w) => ({ value: w.id, label: w.name }))} placeholder="Depo seçin" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cnt-date">Sayım tarihi</Label>
              <Input id="cnt-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tür</Label>
              <MultiSelect value={types} onValueChange={setTypes} placeholder="Tüm türler" options={PRODUCT_TYPES.map((t) => ({ value: t, label: PRODUCT_TYPE_LABELS[t] }))} />
            </div>
            <div className="space-y-1">
              <Label>Aile</Label>
              <MultiSelect value={categories} onValueChange={setCategories} placeholder="Tüm aileler" options={Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Grup kodu</Label>
              <MultiSelect value={groupCodes} onValueChange={setGroupCodes} placeholder="Tüm grup kodları" options={groups.map((g) => ({ value: g.code, label: `${g.code} — ${g.name}` }))} />
            </div>
            <label className="col-span-2 flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={includeZero} onCheckedChange={setIncludeZero} />
              Stoğu olmayan ürünleri de listeye ekle (bulunursa sayılır)
            </label>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="cnt-note">Not</Label>
              <Textarea id="cnt-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn: Ekim ayı sonu sayımı" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Vazgeç
            </Button>
            <Button onClick={submit} disabled={saving || !warehouseId}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sayım listesini oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
