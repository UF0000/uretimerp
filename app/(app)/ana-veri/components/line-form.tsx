"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LineFormValues, lineSchema } from "@/lib/validations/master-data";
import { saveLine } from "@/app/actions/master-data/equipment";
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
interface LineFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: LineFormValues;
}

export function LineForm({ open, onOpenChange, initialData }: LineFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<LineFormValues>({
    resolver: zodResolver(lineSchema),
    defaultValues: initialData || {
      code: "",
      name: "",
      head_type: "",
      status: "active",
    },
  });

  const watchStatus = watch("status");

  const onSubmit = async (data: LineFormValues) => {
    try {
      setIsSubmitting(true);
      await saveLine(data);
      toast.success(initialData ? "Hat güncellendi" : "Hat eklendi");
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
            {initialData ? "Hat Düzenle" : "Yeni Hat Ekle"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Hat Kodu *</Label>
              <Input
                id="code"
                {...register("code")}
                className={errors.code ? "border-danger" : ""}
              />
              {errors.code && (
                <p className="text-xs text-danger">{errors.code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Hat Adı *</Label>
              <Input
                id="name"
                {...register("name")}
                className={errors.name ? "border-danger" : ""}
              />
              {errors.name && (
                <p className="text-xs text-danger">{errors.name.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="head_type">Kafa Tipi</Label>
            <Input
              id="head_type"
              {...register("head_type")}
              placeholder="Örn: 200mm"
            />
          </div>

          <div className="space-y-2">
            <Label>Durum *</Label>
            <Select
              value={watchStatus}
              onValueChange={(val) =>
                setValue("status", val as LineFormValues["status"])
              }
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
