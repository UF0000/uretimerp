"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { WorkOrderFormValues, WorkOrderFormInput, workOrderSchema } from "@/lib/validations/work-orders";
import { saveWorkOrder } from "@/app/actions/work-orders";
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
import { Card, CardContent } from "@/components/ui/card";

import { getErrorMessage, one } from "@/lib/utils";
import type { BomRow } from "@/app/actions/bom";
import type { OrderRow } from "@/app/actions/orders";
interface WorkOrderFormProps {
  products: { id: string; name: string; code: string; type: string }[];
  boms: BomRow[];
  lines: { id: string; name: string; code: string }[];
  molds: { id: string; name: string; code: string }[];
  orders: OrderRow[];
}

export function WorkOrderForm({ products, boms, lines, molds, orders }: WorkOrderFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WorkOrderFormInput, unknown, WorkOrderFormValues>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      no: "",
      product_id: "",
      bom_id: "",
      planned_qty: 0,
      status: "planned",
    },
  });

  const selectedProductId = watch("product_id");
  const filteredBoms = boms.filter(b => b.product_id === selectedProductId && b.active);
  const selectedBomId = watch("bom_id");
  const selectedBom = boms.find(b => b.id === selectedBomId);

  const onSubmit = async (data: WorkOrderFormValues) => {
    try {
      setIsSubmitting(true);
      await saveWorkOrder(data);
      toast.success("İş emri başarıyla oluşturuldu");
      router.push("/uretim/is-emirleri");
      router.refresh();
    } catch (error) {
      toast.error("Hata", { description: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl mx-auto">
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
              <Label>İş Emri Numarası *</Label>
              <Input {...register("no")} placeholder="Örn: WO-2026-001" className={errors.no ? "border-danger" : ""} />
              {errors.no && <p className="text-xs text-danger">{errors.no.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>Bağlı Müşteri Siparişi (Opsiyonel)</Label>
              <SearchableSelect
                value={watch("order_id") || ""}
                onValueChange={(val) => setValue("order_id", val)}
                options={orders.map(o => ({ value: o.id, label: o.no }))}
                placeholder="Sipariş seçiniz (Boş = Stoğa Üretim)"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Üretilecek Ürün *</Label>
            <SearchableSelect
              value={selectedProductId || ""}
              onValueChange={(val) => {
                setValue("product_id", val);
                setValue("bom_id", ""); // Ürün değişirse reçeteyi sıfırla
              }}
              options={products.filter(p => ["finished", "semi"].includes(p.type)).map(p => ({ 
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
              <Label>Kullanılacak Reçete (BOM) *</Label>
              <Select 
                value={selectedBomId || ""} 
                onValueChange={(val) => {
                  setValue("bom_id", val ?? "");
                  // Reçetedeki hat/kalıbı varsayılan olarak forma yaz (kullanıcı değiştirebilir)
                  const bom = boms.find((b) => b.id === val);
                  setValue("line_id", one(bom?.extrusion)?.line_id ?? "");
                  setValue("mold_id", one(bom?.injection)?.mold_id ?? "");
                }}
                disabled={!selectedProductId || filteredBoms.length === 0}
              >
                <SelectTrigger className={errors.bom_id ? "border-danger" : ""}>
                  <SelectValue placeholder={filteredBoms.length === 0 ? "Bu ürüne ait aktif reçete yok" : "Reçete seçiniz"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredBoms.map(b => (
                    <SelectItem key={b.id} value={b.id}>v{b.version} - {b.production_type === 'extrusion' ? 'Ekstrüzyon' : 'Enjeksiyon'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.bom_id && <p className="text-xs text-danger">{errors.bom_id.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Planlanan Miktar *</Label>
              <Input 
                type="number" 
                step="1" 
                {...register("planned_qty", { valueAsNumber: true })} 
                className={errors.planned_qty ? "border-danger" : ""}
              />
              {errors.planned_qty && <p className="text-xs text-danger">{errors.planned_qty.message}</p>}
            </div>
          </div>

          {selectedBom && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-4 border">
              <h4 className="font-medium text-sm">Üretim Parametreleri (Reçeteden Otomatik Alınır)</h4>
              
              {selectedBom.production_type === "extrusion" && (
                <div className="space-y-2">
                  <Label>Planlanan Hat (Opsiyonel)</Label>
                  <SearchableSelect
                    value={watch("line_id") || ""}
                    onValueChange={(val) => setValue("line_id", val)}
                    options={lines.map(l => ({ 
                      value: l.id, 
                      label: `${l.name} (${l.code})`, 
                      searchString: l.code 
                    }))}
                    placeholder="Hat ataması yapın"
                  />
                </div>
              )}

              {selectedBom.production_type === "injection" && (
                <div className="space-y-2">
                  <Label>Kullanılacak Kalıp (Opsiyonel)</Label>
                  <SearchableSelect
                    value={watch("mold_id") || ""}
                    onValueChange={(val) => setValue("mold_id", val)}
                    options={molds.map(m => ({ 
                      value: m.id, 
                      label: `${m.name} (${m.code})`, 
                      searchString: m.code 
                    }))}
                    placeholder="Kalıp ataması yapın"
                  />
                </div>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            İş Emrini Kaydet ve Planla
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
