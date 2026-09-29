"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ncrCreateSchema, NcrCreateFormInput, NcrCreateFormValues } from "@/lib/validations/quality";
import { createNcr } from "@/app/actions/quality";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/utils";

type Warehouse = { id: string; name: string; type: string };

export interface NcrPrefill {
  product_id: string;
  lot_no: string | null;
  quality_check_id: string | null;
}

interface NcrCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: { id: string; code: string; name: string }[];
  warehouses: Warehouse[];
  /** Reddedilen kalite kontrolünden açılırsa ürün/lot hazır gelir */
  prefill: NcrPrefill | null;
}

export function NcrCreateModal({ isOpen, onClose, products, warehouses, prefill }: NcrCreateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const quarantineWarehouses = warehouses.filter((w) => w.type === "quarantine");
  const sourceWarehouses = warehouses.filter((w) => w.type !== "quarantine" && w.type !== "scrap");
  const defaultQuarantineId = quarantineWarehouses[0]?.id ?? "";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<NcrCreateFormInput, unknown, NcrCreateFormValues>({
    resolver: zodResolver(ncrCreateSchema),
  });

  useEffect(() => {
    if (!isOpen) return;
    reset({
      product_id: prefill?.product_id ?? "",
      lot_no: prefill?.lot_no ?? "",
      quality_check_id: prefill?.quality_check_id ?? null,
      description: "",
      quantity: undefined,
      quarantine: false,
      source_warehouse_id: "",
      quarantine_warehouse_id: defaultQuarantineId,
    });
  }, [isOpen, prefill, reset, defaultQuarantineId]);

  const quarantine = Boolean(watch("quarantine"));

  const onSubmit = async (data: NcrCreateFormValues) => {
    try {
      setIsSubmitting(true);
      const r = await createNcr(data);
      toast.success(`${r.no} açıldı`, {
        description: r.quarantined ? "Şüpheli miktar karantina deposuna alındı." : undefined,
      });
      onClose();
    } catch (error) {
      toast.error("NCR açılamadı", { description: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Uygunsuzluk Raporu (NCR) Aç</DialogTitle>
          <DialogDescription>
            {prefill?.quality_check_id ? "Reddedilen kalite kontrolünden açılıyor." : "Numara kayıtta otomatik verilir."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Ürün *</Label>
            <SearchableSelect
              value={watch("product_id") || ""}
              onValueChange={(val) => setValue("product_id", val, { shouldValidate: true })}
              options={products.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}`, searchString: p.code }))}
              placeholder="Ürün seçin"
              className={errors.product_id ? "border-danger" : ""}
            />
            {errors.product_id && <p className="text-xs text-danger">{errors.product_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Lot No</Label>
              <Input {...register("lot_no")} placeholder="Örn. L260929-IE-1-1" />
            </div>
            <div className="space-y-2">
              <Label>Uygun Olmayan Miktar *</Label>
              <Input
                type="number"
                step="0.001"
                {...register("quantity", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
                className={errors.quantity ? "border-danger" : ""}
              />
              {errors.quantity && <p className="text-xs text-danger">{errors.quantity.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Uygunsuzluk Açıklaması *</Label>
            <Textarea {...register("description")} rows={3} placeholder="Ne tespit edildi? (ölçü, yüzey, test sonucu...)" />
            {errors.description && <p className="text-xs text-danger">{errors.description.message}</p>}
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm">
                <span className="font-medium">Şüpheli miktarı karantinaya al</span>
                <span className="block text-xs text-muted-foreground">Stok, karar verilene kadar karantina deposunda bekler.</span>
              </span>
              <Switch
                checked={quarantine}
                disabled={quarantineWarehouses.length === 0}
                onCheckedChange={(val) => setValue("quarantine", val)}
              />
            </label>
            {quarantineWarehouses.length === 0 && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Karantina tipli depo tanımlı değil. Yönetici, Ana Veri &gt; Depolar&apos;dan &quot;Karantina&quot; tipli bir depo eklemeli.
              </p>
            )}
            {quarantine && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Malın Bulunduğu Depo *</Label>
                  <SearchableSelect
                    value={watch("source_warehouse_id") || ""}
                    onValueChange={(val) => setValue("source_warehouse_id", val, { shouldValidate: true })}
                    options={sourceWarehouses.map((w) => ({ value: w.id, label: w.name }))}
                    placeholder="Depo seçin"
                    className={errors.source_warehouse_id ? "border-danger" : ""}
                  />
                  {errors.source_warehouse_id && <p className="text-xs text-danger">{errors.source_warehouse_id.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Karantina Deposu *</Label>
                  <SearchableSelect
                    value={watch("quarantine_warehouse_id") || ""}
                    onValueChange={(val) => setValue("quarantine_warehouse_id", val, { shouldValidate: true })}
                    options={quarantineWarehouses.map((w) => ({ value: w.id, label: w.name }))}
                    placeholder="Depo seçin"
                  />
                  {errors.quarantine_warehouse_id && <p className="text-xs text-danger">{errors.quarantine_warehouse_id.message}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              NCR Aç
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
