"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PartnerFormValues, partnerSchema } from "@/lib/validations/master-data";
import { savePartner } from "@/app/actions/master-data/partners";
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
interface PartnerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: PartnerFormValues;
}

export function PartnerForm({ open, onOpenChange, initialData }: PartnerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: initialData || {
      name: "",
      type: "customer",
      phone: "",
      address: "",
    },
  });

  const watchType = watch("type");

  const onSubmit = async (data: PartnerFormValues) => {
    try {
      setIsSubmitting(true);
      await savePartner(data);
      toast.success(initialData ? "Cari güncellendi" : "Cari eklendi");
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
          <DialogTitle>{initialData ? "Cari Düzenle" : "Yeni Cari Ekle"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Unvan / İsim *</Label>
            <Input id="name" {...register("name")} className={errors.name ? "border-danger" : ""} />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Tip *</Label>
            <Select 
              value={watchType} 
              onValueChange={(val) => setValue("type", val as PartnerFormValues["type"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seçiniz">
                  {watchType === "customer" && "Müşteri"}
                  {watchType === "supplier" && "Tedarikçi"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Müşteri</SelectItem>
                <SelectItem value="supplier">Tedarikçi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" {...register("phone")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adres</Label>
            <Input id="address" {...register("address")} />
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
