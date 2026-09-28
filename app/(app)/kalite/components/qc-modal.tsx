"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { QualityCheckFormValues, qualityCheckSchema } from "@/lib/validations/quality";
import { createQualityCheck } from "@/app/actions/quality";
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
import { SearchableSelect } from "@/components/shared/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { getErrorMessage } from "@/lib/utils";
import type { ProductRow } from "@/app/actions/master-data/products";
import type { WorkOrderRow } from "@/app/actions/work-orders";
interface QCModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductRow[];
  workOrders: WorkOrderRow[];
}

export function QCModal({ isOpen, onClose, products, workOrders }: QCModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<QualityCheckFormValues>({
    resolver: zodResolver(qualityCheckSchema),
    defaultValues: {
      type: "process",
      result: "accept",
      product_id: "",
      work_order_id: null,
      lot_no: "",
    },
  });

  const onSubmit = async (data: QualityCheckFormValues) => {
    try {
      setIsSubmitting(true);
      await createQualityCheck(data);
      toast.success("Kalite kontrol kaydı oluşturuldu.");
      reset();
      onClose();
    } catch (error) {
      toast.error("Hata", { description: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Kalite Kontrol</DialogTitle>
          <DialogDescription>
            Üretimden çıkan veya depoya giren ürünler için kalite kontrol kaydı oluşturun.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Kontrol Tipi</Label>
            <Select 
              value={watch("type")} 
              onValueChange={(val) => setValue("type", val as QualityCheckFormValues["type"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seçiniz">
                  {watch("type") === "incoming" && "Girdi Kontrol"}
                  {watch("type") === "process" && "Proses Kontrol"}
                  {watch("type") === "final" && "Son Kontrol"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="incoming">Girdi Kontrol</SelectItem>
                <SelectItem value="process">Proses Kontrol</SelectItem>
                <SelectItem value="final">Son Kontrol</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ürün *</Label>
            <SearchableSelect
              value={watch("product_id")}
              onValueChange={(val) => setValue("product_id", val)}
              options={products.map(p => ({ 
                value: p.id, 
                label: `${p.name} (${p.code})`, 
                searchString: p.code 
              }))}
              placeholder="Ürün seçin"
              className={errors.product_id ? "border-danger" : ""}
            />
            {errors.product_id && <p className="text-xs text-danger">{errors.product_id.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>İş Emri (Opsiyonel)</Label>
            <SearchableSelect
              value={watch("work_order_id") || "none"}
              onValueChange={(val) => setValue("work_order_id", val === "none" ? null : val)}
              options={[
                { value: "none", label: "Bağımsız (İş emri yok)" },
                ...workOrders.map(w => ({ value: w.id, label: `${w.no} - ${w.product?.code}`, searchString: w.no }))
              ]}
              placeholder="İlgili iş emri seçin"
            />
          </div>

          <div className="space-y-2">
            <Label>Lot No (Opsiyonel)</Label>
            <Input {...register("lot_no")} placeholder="Örn: L-20260703-01" />
          </div>

          <div className="space-y-2">
            <Label>Sonuç *</Label>
            <Select 
              value={watch("result")} 
              onValueChange={(val) => setValue("result", val as QualityCheckFormValues["result"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seçiniz">
                  {watch("result") === "accept" && "Kabul"}
                  {watch("result") === "conditional" && "Şartlı Kabul"}
                  {watch("result") === "reject" && "Red"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accept">Kabul</SelectItem>
                <SelectItem value="conditional">Şartlı Kabul</SelectItem>
                <SelectItem value="reject">Red</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {watch("result") === "reject" && (
            <div className="p-3 bg-danger/10 text-danger text-sm rounded-md border border-danger/20">
              Dikkat: Red edilen ürünler için NCR (Uygunsuzluk Raporu) açılması önerilir.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
