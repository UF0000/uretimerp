"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { OrderFormValues, OrderFormInput, orderSchema } from "@/lib/validations/orders";
import { saveOrder } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { getErrorMessage } from "@/lib/utils";
interface OrderFormProps {
  products: { id: string; name: string; code: string; type: string }[];
  partners: { id: string; name: string; type: string }[];
}

export function OrderForm({ products, partners }: OrderFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Müşteri (Cari) Listesi (sadece customer olanları veya hepsini filtreleyebiliriz)
  const customers = partners.filter(p => p.type === "customer");
  
  // Satılabilir Ürünler: Mamul, Yarı Mamul, Hammadde (User isteği doğrultusunda)
  const sellableProducts = products.filter(p => ["finished", "semi", "raw"].includes(p.type));

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrderFormInput, unknown, OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      no: "",
      partner_id: "",
      order_date: new Date().toISOString().split("T")[0],
      delivery_date: "",
      status: "open",
      items: [{ product_id: "", quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const onSubmit = async (data: OrderFormValues) => {
    try {
      setIsSubmitting(true);
      await saveOrder(data);
      toast.success("Sipariş başarıyla oluşturuldu");
      router.push("/siparisler");
      router.refresh();
    } catch (error) {
      toast.error("Hata", { description: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Geri Dön
        </Button>
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Siparişi Kaydet
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sipariş Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Sipariş Numarası *</Label>
                <Input {...register("no")} placeholder="Örn: SIP-2026-001" className={errors.no ? "border-danger" : ""} />
                {errors.no && <p className="text-xs text-danger">{errors.no.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Müşteri *</Label>
                <SearchableSelect
                  value={watch("partner_id") || ""}
                  onValueChange={(val) => setValue("partner_id", val)}
                  options={customers.map(p => ({ value: p.id, label: p.name }))}
                  placeholder="Müşteri seçiniz"
                  className={errors.partner_id ? "border-danger" : ""}
                />
                {errors.partner_id && <p className="text-xs text-danger">{errors.partner_id.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Sipariş Tarihi *</Label>
                <Input type="date" {...register("order_date")} className={errors.order_date ? "border-danger" : ""} />
              </div>

              <div className="space-y-2">
                <Label>Hedef Teslim Tarihi</Label>
                <Input type="date" {...register("delivery_date")} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Sipariş Kalemleri</CardTitle>
              <Button type="button" size="sm" variant="secondary" onClick={() => append({ product_id: "", quantity: 1 })}>
                <Plus className="w-4 h-4 mr-2" />
                Ürün Ekle
              </Button>
            </CardHeader>
            <CardContent>
              {errors.items && typeof errors.items.message === 'string' && (
                <p className="text-xs text-danger mb-4">{errors.items.message}</p>
              )}
              
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-4 p-4 border rounded-lg bg-card">
                    <div className="flex-1 grid grid-cols-12 gap-4">
                      
                      <div className="col-span-8 space-y-2">
                        <Label>Sipariş Edilen Ürün *</Label>
                        <SearchableSelect
                          value={watch(`items.${index}.product_id`) || ""}
                          onValueChange={(val) => setValue(`items.${index}.product_id`, val)}
                          options={sellableProducts.map(p => ({ 
                            value: p.id, 
                            label: `${p.name} (${p.code})`, 
                            searchString: p.code 
                          }))}
                          placeholder="Ürün seçiniz"
                          className={errors?.items?.[index]?.product_id ? "border-danger" : ""}
                        />
                      </div>

                      <div className="col-span-4 space-y-2">
                        <Label>Sipariş Miktarı *</Label>
                        <Input type="number" step="0.1" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="mt-6 text-danger hover:bg-danger/10"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                
                {fields.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    Siparişe henüz ürün eklenmedi.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
