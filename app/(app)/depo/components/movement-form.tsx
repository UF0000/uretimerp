"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { StockMovementFormValues, stockMovementSchema } from "@/lib/validations/stock";
import { saveStockMovement } from "@/app/actions/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Card, CardContent } from "@/components/ui/card";

import { getErrorMessage } from "@/lib/utils";
interface MovementFormProps {
  products: { id: string; name: string; code: string; type: string }[];
  warehouses: { id: string; name: string; type: string }[];
}

export function MovementForm({ products, warehouses }: MovementFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StockMovementFormValues>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: {
      product_id: "",
      warehouse_id: "",
      direction: "in",
      quantity: 0,
      source_type: "count",
    },
  });

  const onSubmit = async (data: StockMovementFormValues) => {
    try {
      setIsSubmitting(true);
      await saveStockMovement(data);
      toast.success("Stok hareketi başarıyla kaydedildi");
      router.push("/depo/hareketler");
      router.refresh();
    } catch (error) {
      toast.error("Hata", { description: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Geri Dön
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>İşlem Yönü *</Label>
              <Select 
                value={watch("direction")} 
                onValueChange={(val) => setValue("direction", val as StockMovementFormValues["direction"])}
              >
                <SelectTrigger className={errors.direction ? "border-danger" : ""}>
                  <SelectValue placeholder="Seçiniz">
                    {watch("direction") === "in" && "Stok Girişi (+)"}
                    {watch("direction") === "out" && "Stok Çıkışı (-)"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Stok Girişi (+)</SelectItem>
                  <SelectItem value="out">Stok Çıkışı (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Hareket Tipi (Kaynak) *</Label>
              <Select 
                value={watch("source_type")} 
                onValueChange={(val) => setValue("source_type", val as StockMovementFormValues["source_type"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seçiniz">
                    {watch("source_type") === "count" && "Sayım Farkı / Düzeltme"}
                    {watch("source_type") === "purchase" && "Satınalma (Fatura/İrsaliye)"}
                    {watch("source_type") === "transfer" && "Depolar Arası Transfer"}
                    {watch("source_type") === "scrap" && "Fire / Hurda Çıkışı"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Sayım Farkı / Düzeltme</SelectItem>
                  <SelectItem value="purchase">Satınalma (Fatura/İrsaliye)</SelectItem>
                  <SelectItem value="transfer">Depolar Arası Transfer</SelectItem>
                  <SelectItem value="scrap">Fire / Hurda Çıkışı</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              placeholder="Ürün seçiniz"
              className={errors.product_id ? "border-danger" : ""}
            />
            {errors.product_id && <p className="text-xs text-danger">{errors.product_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Depo *</Label>
              <SearchableSelect
                value={watch("warehouse_id")}
                onValueChange={(val) => setValue("warehouse_id", val)}
                options={warehouses.map(w => ({ value: w.id, label: w.name }))}
                placeholder="Depo seçiniz"
                className={errors.warehouse_id ? "border-danger" : ""}
              />
              {errors.warehouse_id && <p className="text-xs text-danger">{errors.warehouse_id.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Miktar *</Label>
              <Input 
                type="number" 
                step="0.001" 
                {...register("quantity", { valueAsNumber: true })} 
                className={errors.quantity ? "border-danger" : ""}
              />
              {errors.quantity && <p className="text-xs text-danger">{errors.quantity.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Lot Numarası (Parti No) - Opsiyonel</Label>
            <Input {...register("lot_no")} placeholder="Örn: 20260703-01" />
          </div>

          <div className="space-y-2">
            <Label>Açıklama</Label>
            <Textarea {...register("note")} placeholder="İşlem detayı..." className="resize-none" rows={3} />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Fişi Kaydet (Geri Alınamaz)
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
