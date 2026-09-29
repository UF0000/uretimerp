"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ReasonCodeFormValues,
  reasonCodeSchema,
} from "@/lib/validations/master-data";
import { saveReasonCode } from "@/app/actions/master-data/reason-codes";
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
interface ReasonCodeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: ReasonCodeFormValues;
  /** Yeni kayıtta seçili gelecek tür */
  defaultKind?: ReasonCodeFormValues["kind"];
}

export function ReasonCodeForm({
  open,
  onOpenChange,
  initialData,
  defaultKind = "downtime",
}: ReasonCodeFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ReasonCodeFormValues>({
    resolver: zodResolver(reasonCodeSchema),
    defaultValues: initialData || {
      kind: defaultKind,
      code: "",
      label: "",
    },
  });

  const watchKind = watch("kind");

  const onSubmit = async (data: ReasonCodeFormValues) => {
    try {
      setIsSubmitting(true);
      await saveReasonCode(data);
      toast.success(initialData ? "Kod güncellendi" : "Kod eklendi");
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
            {initialData ? "Kod Düzenle" : "Yeni Neden Kodu Ekle"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Kod Tipi *</Label>
            <Select
              value={watchKind}
              onValueChange={(val) =>
                setValue("kind", val as ReasonCodeFormValues["kind"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seçiniz">
                  {watchKind === "downtime" && "Duruş Kodu"}
                  {watchKind === "scrap" && "Fire Kodu"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="downtime">Duruş Kodu</SelectItem>
                <SelectItem value="scrap">Fire Kodu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Kod *</Label>
            <Input
              id="code"
              {...register("code")}
              className={errors.code ? "border-danger" : ""}
              placeholder="Örn: M01"
            />
            {errors.code && (
              <p className="text-xs text-danger">{errors.code.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Açıklama *</Label>
            <Input
              id="label"
              {...register("label")}
              className={errors.label ? "border-danger" : ""}
              placeholder="Örn: Elektrik Kesintisi"
            />
            {errors.label && (
              <p className="text-xs text-danger">{errors.label.message}</p>
            )}
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
