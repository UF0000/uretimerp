"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  WarehouseFormValues,
  warehouseSchema,
} from "@/lib/validations/master-data";
import { saveWarehouse } from "@/app/actions/master-data/warehouses";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
interface WarehouseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: WarehouseFormValues;
}

export function WarehouseForm({
  open,
  onOpenChange,
  initialData,
}: WarehouseFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: initialData || {
      name: "",
      type: "raw",
    },
  });

  const watchType = watch("type");

  const onSubmit = async (data: WarehouseFormValues) => {
    try {
      setIsSubmitting(true);
      await saveWarehouse(data);
      toast.success(initialData ? "Depo güncellendi" : "Depo eklendi");
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Depo Düzenle" : "Yeni Depo Ekle"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Depo Adı *</Label>
            <Input
              id="name"
              {...register("name")}
              className={errors.name ? "border-danger" : ""}
            />
            {errors.name && (
              <p className="text-xs text-danger">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Depo Tipi *</Label>
            <Select
              value={watchType}
              onValueChange={(val) =>
                setValue("type", val as WarehouseFormValues["type"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seçiniz">
                  {watchType === "raw" && "Hammadde Deposu"}
                  {watchType === "finished" && "Mamul Deposu"}
                  {watchType === "regrind" && "Regrind (Kırma) Deposu"}
                  {watchType === "scrap" && "Hurda Deposu"}
                  {watchType === "quarantine" && "Karantina Deposu"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="raw">Hammadde Deposu</SelectItem>
                <SelectItem value="finished">Mamul Deposu</SelectItem>
                <SelectItem value="regrind">Regrind (Kırma) Deposu</SelectItem>
                <SelectItem value="scrap">Hurda Deposu</SelectItem>
                <SelectItem value="quarantine">Karantina Deposu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
