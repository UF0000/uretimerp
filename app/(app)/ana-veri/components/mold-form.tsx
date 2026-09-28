"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MoldFormValues, MoldFormInput, moldSchema } from "@/lib/validations/master-data";
import { saveMold } from "@/app/actions/master-data/equipment";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/shared/searchable-select";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { getErrorMessage } from "@/lib/utils";
interface MoldFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: MoldFormInput;
  products: { id: string; code: string; name: string }[];
}

export function MoldForm({ open, onOpenChange, initialData, products }: MoldFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<MoldFormInput, unknown, MoldFormValues>({
    resolver: zodResolver(moldSchema),
    defaultValues: initialData || {
      code: "",
      name: "",
      product_id: "",
      cavity_count: 1,
      cycle_time_sec: 10,
      total_shots: 0,
      maintenance_plan: "",
      status: "active",
    },
  });

  const watchStatus = watch("status");
  const watchProduct = watch("product_id");

  const onSubmit = async (data: MoldFormValues) => {
    try {
      setIsSubmitting(true);
      await saveMold(data);
      toast.success(initialData ? "Kalıp güncellendi" : "Kalıp eklendi");
      onOpenChange(false);
      reset();
    } catch (error) {
      toast.error("Hata", { description: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{initialData ? "Kalıp Düzenle" : "Yeni Kalıp Ekle"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Kalıp Kodu *</Label>
              <Input id="code" {...register("code")} className={errors.code ? "border-danger" : ""} />
              {errors.code && <p className="text-xs text-danger">{errors.code.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Kalıp Adı *</Label>
              <Input id="name" {...register("name")} className={errors.name ? "border-danger" : ""} />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bağlı Ürün</Label>
            <SearchableSelect
              value={watchProduct || ""}
              onValueChange={(val) => setValue("product_id", val === "none" ? null : val)}
              options={[
                { value: "none", label: "-- Ürün Bağlı Değil --", searchString: "" },
                ...products.map((p) => ({
                  value: p.id!,
                  label: `${p.name} (${p.code})`,
                  searchString: p.code,
                })),
              ]}
              placeholder="Ürün seçiniz"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cavity_count">Göz Sayısı *</Label>
              <Input id="cavity_count" type="number" step="1" {...register("cavity_count", { valueAsNumber: true })} />
            </div>

            <div className="space-y-2">
              <div className="flex flex-col">
                <Label htmlFor="cycle_time_sec">Çevrim Süresi *</Label>
                <span className="text-[10px] text-muted-foreground">(Baskı Başına - Sn)</span>
              </div>
              <Input id="cycle_time_sec" type="number" step="0.1" {...register("cycle_time_sec", { valueAsNumber: true })} />
            </div>
            
            <div className="space-y-2">
              <div className="flex flex-col">
                <Label htmlFor="product_weight_g">Plastik Ağırlığı</Label>
                <span className="text-[10px] text-muted-foreground">(Ürün Başına - g)</span>
              </div>
              <Input id="product_weight_g" type="number" step="0.1" {...register("product_weight_g", { valueAsNumber: true })} />
            </div>
            
            <div className="space-y-2">
              <div className="flex flex-col">
                <Label htmlFor="sprue_weight_g">Toplam Yolluk Ağırlığı</Label>
                <span className="text-[10px] text-muted-foreground">(Baskı Başına - g)</span>
              </div>
              <Input id="sprue_weight_g" type="number" step="0.1" {...register("sprue_weight_g", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Durum *</Label>
            <Select 
              value={watchStatus} 
              onValueChange={(val) => setValue("status", val as MoldFormInput["status"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seçiniz">
                  {watchStatus === "active" && "Aktif"}
                  {watchStatus === "maintenance" && "Bakımda"}
                  {watchStatus === "down" && "Arızalı"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="maintenance">Bakımda</SelectItem>
                <SelectItem value="down">Arızalı</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
