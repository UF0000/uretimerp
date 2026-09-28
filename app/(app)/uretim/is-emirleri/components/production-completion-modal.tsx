"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ProductionCompletionFormValues, ProductionCompletionFormInput, productionCompletionSchema } from "@/lib/validations/production";
import { completeWorkOrder } from "@/app/actions/production";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { getErrorMessage, one } from "@/lib/utils";
import { formatTR } from "@/lib/format";
import type { WorkOrderRow } from "@/app/actions/work-orders";

interface ProductionCompletionModalProps {
  workOrder: WorkOrderRow | null;
  isOpen: boolean;
  onClose: () => void;
  scrapProducts: { id: string; name: string; code: string }[];
  /** Mamulün girebileceği depolar (type = finished) */
  targetWarehouses: { id: string; name: string }[];
}

export function ProductionCompletionModal({ workOrder, isOpen, onClose, scrapProducts, targetWarehouses }: ProductionCompletionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProductionCompletionFormInput, unknown, ProductionCompletionFormValues>({
    resolver: zodResolver(productionCompletionSchema),
    defaultValues: {
      work_order_id: "",
      total_used_kg: 0,
      scrap_kg: 0,
      produced_qty: 0,
      scrap_product_id: "",
      target_warehouse_id: "",
      shift: "day",
      operator: "",
    },
  });

  // When workOrder changes, reset the form
  useEffect(() => {
    if (workOrder) {
      let defaultScrapKg = 0;
      let defaultScrapProductId = "";
      const produced = Number(workOrder.planned_qty) || 0;

      // Reçete detayları bire bir ilişki: veritabanı tek nesne döndürür
      const bom = one(workOrder.bom);
      const inj = one(bom?.bom_injection);
      const ext = one(bom?.bom_extrusion);
      if (bom?.production_type === "injection" && inj) {
        defaultScrapProductId = inj.scrap_product_id || "";
        const cavity = inj.cavity_count || 1;
        const sprue = inj.runner_sprue_weight_g || 0;
        defaultScrapKg = Number(((produced / cavity) * sprue / 1000).toFixed(2));
      } else if (bom?.production_type === "extrusion" && ext) {
        defaultScrapProductId = ext.scrap_product_id || "";
      }

      reset({
        work_order_id: workOrder.id,
        total_used_kg: 0,
        scrap_kg: defaultScrapKg,
        produced_qty: produced,
        scrap_product_id: defaultScrapProductId,
        target_warehouse_id: targetWarehouses[0]?.id ?? "",
        shift: "day",
        operator: "",
      });
    }
  }, [workOrder, reset, targetWarehouses]);

  const totalUsed = watch("total_used_kg") || 0;
  const scrapKg = watch("scrap_kg") || 0;
  const producedQty = watch("produced_qty") || 0;
  
  const netWeight = Math.max(0, totalUsed - scrapKg);
  const unitWeight = producedQty > 0 ? (netWeight / producedQty) : 0;
  const scrapRate = totalUsed > 0 ? (scrapKg / totalUsed) * 100 : 0;

  const onSubmit = async (data: ProductionCompletionFormValues) => {
    try {
      setIsSubmitting(true);
      const { lotNo, moldShots } = await completeWorkOrder(data);
      toast.success("Üretim sonu kaydedildi, stoklar güncellendi.", {
        description: `Lot: ${lotNo}${moldShots > 0 ? ` · Kalıp sayacına ${formatTR(moldShots, 0)} atış eklendi` : ""}`,
      });
      onClose();
    } catch (error) {
      toast.error("Hata", { description: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!workOrder) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Üretim Sonu Fişi</DialogTitle>
          <DialogDescription>
            <strong>{workOrder.no}</strong> numaralı iş emri için gerçekleşen üretim değerlerini girin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vardiya *</Label>
              <Select 
                value={watch("shift")} 
                onValueChange={(val) => setValue("shift", val as ProductionCompletionFormInput["shift"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vardiya">
                    {watch("shift") === "day" && "Gündüz"}
                    {watch("shift") === "night" && "Gece"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Gündüz</SelectItem>
                  <SelectItem value="night">Gece</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Operatör (Opsiyonel)</Label>
              <Input {...register("operator")} placeholder="İsim soyisim..." />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Üretilen Sağlam Ürün ({workOrder.product?.unit}) *</Label>
            <Input 
              type="number" 
              step="0.01" 
              {...register("produced_qty", { valueAsNumber: true })} 
              className={errors.produced_qty ? "border-danger" : ""}
            />
            {errors.produced_qty && <p className="text-xs text-danger">{errors.produced_qty.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Toplam Harcanan (Kg) *</Label>
              <Input 
                type="number" 
                step="0.01" 
                {...register("total_used_kg", { valueAsNumber: true })} 
                className={errors.total_used_kg ? "border-danger" : ""}
              />
              {errors.total_used_kg && <p className="text-xs text-danger">{errors.total_used_kg.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Çıkan Fire (Kg) *</Label>
              <Input 
                type="number" 
                step="0.01" 
                {...register("scrap_kg", { valueAsNumber: true })} 
                className={errors.scrap_kg ? "border-danger" : ""}
              />
              {errors.scrap_kg && <p className="text-xs text-danger">{errors.scrap_kg.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mamulün Gireceği Depo *</Label>
            <Select
              value={watch("target_warehouse_id") || ""}
              onValueChange={(val) => setValue("target_warehouse_id", val ?? "", { shouldValidate: true })}
            >
              <SelectTrigger className={errors.target_warehouse_id ? "border-danger" : ""}>
                <SelectValue placeholder="Depo seçin">
                  {targetWarehouses.find((w) => w.id === watch("target_warehouse_id"))?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {targetWarehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.target_warehouse_id && <p className="text-xs text-danger">{errors.target_warehouse_id.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Fire Hangi Hurda Ürününe İşlensin?{scrapKg > 0 && " *"}</Label>
            <Select 
              value={watch("scrap_product_id") || ""} 
              onValueChange={(val) => setValue("scrap_product_id", val, { shouldValidate: true })}
            >
              <SelectTrigger className={errors.scrap_product_id ? "border-danger" : ""}>
                <SelectValue placeholder="Fire stoku girilmesin" />
              </SelectTrigger>
              <SelectContent>
                {scrapProducts.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.scrap_product_id && <p className="text-xs text-danger">{errors.scrap_product_id.message}</p>}
          </div>

          <div className="p-3 bg-muted/50 rounded-md text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sağlam Ürün Ağırlığı:</span>
              <span className="font-medium">{netWeight.toFixed(2)} Kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ortalama Birim Ağırlık:</span>
              <span className="font-medium">{unitWeight.toFixed(3)} Kg/{workOrder.product?.unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fire Oranı:</span>
              <span className={scrapRate > 10 ? "font-medium text-danger" : "font-medium"}>
                %{scrapRate.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Üretimi Bitir
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
