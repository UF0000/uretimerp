"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveProduct } from "@/app/actions/master-data/products";
import {
  ProductFormValues,
  ProductFormInput,
  productSchema,
} from "@/lib/validations/master-data";
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
interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: ProductFormInput;
}

export function ProductForm({
  open,
  onOpenChange,
  initialData,
}: ProductFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: initialData || {
      code: "",
      name: "",
      type: "finished",
      unit: "adet",
      category: "",
      material_grade: "",
      min_stock: 0,
      critical_stock: 0,
    },
  });

  const watchType = watch("type");

  const onSubmit = async (data: ProductFormValues) => {
    try {
      setIsSubmitting(true);
      await saveProduct(data);
      toast.success(initialData ? "Ürün güncellendi" : "Ürün eklendi");
      onOpenChange(false);
      reset();
    } catch (error) {
      toast.error("Hata oluştu", { description: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Ürün Düzenle" : "Yeni Ürün Ekle"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Kodu *</Label>
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
              <Label htmlFor="name">Adı *</Label>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tip *</Label>
              <Select
                value={watchType}
                onValueChange={(val) =>
                  setValue("type", val as ProductFormInput["type"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seçiniz">
                    {watchType === "finished" && "Mamul (Bitmiş Ürün)"}
                    {watchType === "raw" && "Hammadde"}
                    {watchType === "semi" && "Yarı Mamul"}
                    {watchType === "regrind" && "Regrind (Kırma)"}
                    {watchType === "scrap" && "Hurda"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="finished">Mamul (Bitmiş Ürün)</SelectItem>
                  <SelectItem value="raw">Hammadde</SelectItem>
                  <SelectItem value="semi">Yarı Mamul</SelectItem>
                  <SelectItem value="regrind">Regrind (Kırma)</SelectItem>
                  <SelectItem value="scrap">Hurda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Birim *</Label>
              <Select
                value={watch("unit")}
                onValueChange={(val) =>
                  setValue("unit", val as ProductFormInput["unit"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seçiniz">
                    {watch("unit") === "adet" && "Adet"}
                    {watch("unit") === "kg" && "Kg"}
                    {watch("unit") === "metre" && "Metre"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adet">Adet</SelectItem>
                  <SelectItem value="kg">Kg</SelectItem>
                  <SelectItem value="metre">Metre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={watch("category") || ""}
                onValueChange={(val) => setValue("category", val ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kategori Seçiniz">
                    {watch("category") === "baglanti_parcasi" &&
                      "Bağlantı Parçası"}
                    {watch("category") === "boru" && "Boru"}
                    {watch("category") === "hammadde" && "Hammadde"}
                    {watch("category") === "sarf_malzeme" && "Sarf Malzeme"}
                    {watch("category") === "ambalaj" && "Ambalaj / Paketleme"}
                    {watch("category") === "yedek_parca" && "Yedek Parça"}
                    {watch("category") === "diger" && "Diğer"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baglanti_parcasi">
                    Bağlantı Parçası
                  </SelectItem>
                  <SelectItem value="boru">Boru</SelectItem>
                  <SelectItem value="hammadde">Hammadde</SelectItem>
                  <SelectItem value="sarf_malzeme">Sarf Malzeme</SelectItem>
                  <SelectItem value="ambalaj">Ambalaj / Paketleme</SelectItem>
                  <SelectItem value="yedek_parca">Yedek Parça</SelectItem>
                  <SelectItem value="diger">Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(watchType === "raw" ||
              watchType === "regrind" ||
              watchType === "scrap") && (
              <div className="space-y-2">
                <Label htmlFor="material_grade">Malzeme Grade</Label>
                <Input
                  id="material_grade"
                  {...register("material_grade")}
                  placeholder="Örn: PE100"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_stock">Min. Stok (Uyarı)</Label>
              <Input
                id="min_stock"
                type="number"
                step="any"
                {...register("min_stock", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="critical_stock">Kritik Stok (Acil)</Label>
              <Input
                id="critical_stock"
                type="number"
                step="any"
                {...register("critical_stock", { valueAsNumber: true })}
              />
            </div>
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
