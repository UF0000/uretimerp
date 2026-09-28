"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { BomFormValues, BomFormInput, bomSchema } from "@/lib/validations/bom";
import { saveBom } from "@/app/actions/bom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { getErrorMessage } from "@/lib/utils";
interface BomFormProps {
  initialData?: BomFormValues;
  products: { id: string; name: string; code: string; type: string }[];
  lines: { id: string; name: string; code: string }[];
  molds: {
    id: string;
    name: string;
    code: string;
    product_id: string | null;
    cavity_count: number | null;
    cycle_time_sec: number | null;
    sprue_weight_g: number | null;
    product_weight_g: number | null;
  }[];
}

export function BomForm({ initialData, products, lines, molds }: BomFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter products for BOM (Finished/Semi) and Components (Raw/Semi)
  const masterProducts = products.filter(p => ["finished", "semi"].includes(p.type));
  const componentProducts = products.filter(p => ["raw", "semi", "regrind"].includes(p.type));
  const scrapProducts = products.filter(p => ["scrap", "regrind"].includes(p.type));

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<BomFormInput, unknown, BomFormValues>({
    resolver: zodResolver(bomSchema),
    defaultValues: initialData || {
      product_id: "",
      version: 1,
      active: true,
      production_type: "extrusion",
      regrind_pct: 0,
      notes: "",
      items: [{ component_product_id: "", quantity: 0, unit: "kg", ratio_pct: 100 }],
      extrusion: { line_id: "", kg_per_meter: 0, scrap_pct: 0 },
      injection: { mold_id: "", cavity_count: 1, cycle_time_sec: 10, runner_sprue_weight_g: 0 },
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchProductionType = watch("production_type");
  const watchActive = watch("active");
  const watchInjection = watch("injection");

  // Calculate Total Required Weight (per product) in KG
  let totalTargetWeightKg = 0;
  if (watchProductionType === "injection" && watchInjection) {
    const pw = watchInjection.product_weight_g || 0;
    const sw = watchInjection.runner_sprue_weight_g || 0;
    const cav = watchInjection.cavity_count || 1;
    totalTargetWeightKg = (pw + (sw / cav)) / 1000;
  }

  const ratiosStr = watch("items")?.map(i => i.ratio_pct).join(',');
  
  useEffect(() => {
    if (totalTargetWeightKg > 0) {
      const currentItems = watch("items") || [];
      currentItems.forEach((item, idx) => {
        const expectedQty = Number(((totalTargetWeightKg * (item.ratio_pct || 0)) / 100).toFixed(6));
        if (item.quantity !== expectedQty) {
          setValue(`items.${idx}.quantity`, expectedQty);
          setValue(`items.${idx}.unit`, "kg");
        }
      });
    }
  }, [totalTargetWeightKg, ratiosStr, setValue, watch]);

  const handleAppendItem = () => {
    const currentItems = watch("items") || [];
    const currentTotalPct = currentItems.reduce((sum, item) => sum + (item.ratio_pct || 0), 0);
    const remainingPct = currentTotalPct < 100 ? 100 - currentTotalPct : 0;
    
    append({ component_product_id: "", quantity: 0, unit: "kg", ratio_pct: remainingPct });
  };

  const handleRatioChange = (changedIndex: number, newValue: number) => {
    const items = getValues("items") || [];
    if (items.length < 2) return;
    
    // Her zaman bir SONRAKİ hammaddeyi (yoksa en baştakini) hedef alalım
    let targetIndex = changedIndex + 1;
    if (targetIndex >= items.length) {
      targetIndex = 0;
    }
    
    let sumOthers = 0;
    items.forEach((item, idx) => {
      if (idx !== changedIndex && idx !== targetIndex) {
        sumOthers += (item.ratio_pct || 0);
      }
    });
    
    const remainder = 100 - sumOthers - newValue;
    const finalVal = Math.max(0, remainder);
    
    setValue(`items.${targetIndex}.ratio_pct`, Number(finalVal.toFixed(2)), { shouldValidate: true });
  };

  const onSubmit = async (data: BomFormValues) => {
    try {
      setIsSubmitting(true);
      const result = await saveBom(data);
      if (result.newVersion) {
        toast.success(`Yeni versiyon oluşturuldu: v${result.version}`, {
          description: "Eski versiyon üretimde kullanıldığı için korunup pasife alındı.",
        });
      } else {
        toast.success(initialData ? "Reçete güncellendi" : `Reçete oluşturuldu (v${result.version})`);
      }
      router.push("/recete");
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
            {initialData ? "Değişiklikleri Kaydet" : "Reçeteyi Kaydet"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sol Kolon: Temel Bilgiler */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reçete Üst Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Üretilecek Ürün *</Label>
                <SearchableSelect
                  value={watch("product_id")}
                  onValueChange={(val) => {
                    setValue("product_id", val);
                    
                    // Eğer ürün seçildiğinde bu ürüne bağlı bir kalıp varsa otomatik seç ve verilerini doldur
                    const matchingMold = molds.find(m => m.product_id === val);
                    if (matchingMold) {
                      setValue("injection.mold_id", matchingMold.id!);
                      if (matchingMold.cavity_count != null) setValue("injection.cavity_count", matchingMold.cavity_count);
                      if (matchingMold.cycle_time_sec != null) setValue("injection.cycle_time_sec", matchingMold.cycle_time_sec);
                      if (matchingMold.sprue_weight_g != null) setValue("injection.runner_sprue_weight_g", matchingMold.sprue_weight_g);
                      if (matchingMold.product_weight_g != null) setValue("injection.product_weight_g", matchingMold.product_weight_g);
                    }
                  }}
                  options={masterProducts.map(p => ({ 
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
                  <Label>Versiyon</Label>
                  <Input value={initialData ? `v${initialData.version}` : "Kayıtta atanır"} readOnly disabled />
                  {initialData && (
                    <p className="text-xs text-muted-foreground">
                      Üretimde kullanıldıysa kaydedince yeni versiyon açılır; eskisi korunur.
                    </p>
                  )}
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                  <div className="flex items-center space-x-2 pb-2">
                    <Switch
                      checked={watchActive}
                      onCheckedChange={(val) => setValue("active", val)}
                    />
                    <Label>Aktif Reçete</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Üretim Tipi *</Label>
                <Select 
                  value={watchProductionType} 
                  onValueChange={(val) => setValue("production_type", val as BomFormInput["production_type"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seçiniz">
                      {watchProductionType === "extrusion" && "Ekstrüzyon"}
                      {watchProductionType === "injection" && "Enjeksiyon"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="extrusion">Ekstrüzyon</SelectItem>
                    <SelectItem value="injection">Enjeksiyon</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Maksimum Kırma / Regrind Oranı (%)</Label>
                <Input type="number" step="1" {...register("regrind_pct", { valueAsNumber: true })} />
              </div>

              <div className="space-y-2">
                <Label>Reçete Notları</Label>
                <Textarea {...register("notes")} placeholder="Özel notlar..." className="resize-none" rows={3} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sağ Kolon: Detaylar ve İçerik */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Makine ve Proses Ayarları */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Proses Ayarları</CardTitle>
            </CardHeader>
            <CardContent>
              {watchProductionType === "extrusion" ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Kullanılacak Hat</Label>
                    <SearchableSelect
                      value={watch("extrusion.line_id") || ""}
                      onValueChange={(val) => setValue("extrusion.line_id", val)}
                      options={lines.map(l => ({ 
                        value: l.id, 
                        label: `${l.name} (${l.code})`, 
                        searchString: l.code 
                      }))}
                      placeholder="Hat seçiniz"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hedef Metre Ağırlığı (Kg/m)</Label>
                    <Input type="number" step="0.001" {...register("extrusion.kg_per_meter", { valueAsNumber: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hedef Hız (m/saat)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="OEE performansı için"
                      {...register("extrusion.target_m_per_hour", {
                        setValueAs: (v: string) => (v === "" || v === null ? null : Number(v)),
                      })}
                    />
                    {errors.extrusion?.target_m_per_hour && (
                      <p className="text-xs text-danger">{errors.extrusion.target_m_per_hour.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Hedef Fire Oranı (%)</Label>
                    <Input type="number" step="0.1" {...register("extrusion.scrap_pct", { valueAsNumber: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fire/Kırma Ürünü (Opsy.)</Label>
                    <SearchableSelect
                      value={watch("extrusion.scrap_product_id") || ""}
                      onValueChange={(val) => setValue("extrusion.scrap_product_id", val)}
                      options={scrapProducts.map(p => ({ 
                        value: p.id, 
                        label: `${p.name} (${p.code})`, 
                        searchString: p.code 
                      }))}
                      placeholder="Ürün seçiniz"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Kullanılacak Kalıp</Label>
                    <SearchableSelect
                      value={watch("injection.mold_id") || ""}
                      onValueChange={(val) => {
                        setValue("injection.mold_id", val);
                        // Auto-fill values from the selected mold
                        const selectedMold = molds.find(m => m.id === val);
                        if (selectedMold) {
                          if (selectedMold.cavity_count != null) setValue("injection.cavity_count", selectedMold.cavity_count);
                          if (selectedMold.cycle_time_sec != null) setValue("injection.cycle_time_sec", selectedMold.cycle_time_sec);
                          if (selectedMold.sprue_weight_g != null) setValue("injection.runner_sprue_weight_g", selectedMold.sprue_weight_g);
                          if (selectedMold.product_weight_g != null) setValue("injection.product_weight_g", selectedMold.product_weight_g);
                        }
                      }}
                      options={molds.map(m => ({ 
                        value: m.id, 
                        label: `${m.name} (${m.code})`, 
                        searchString: m.code 
                      }))}
                      placeholder="Kalıp seçiniz"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Göz Sayısı</Label>
                    <Input type="number" {...register("injection.cavity_count", { valueAsNumber: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Çevrim Süresi (Baskı Başına - Sn)</Label>
                    <Input type="number" step="0.1" {...register("injection.cycle_time_sec", { valueAsNumber: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Plastik Ağırlığı (Ürün Başına - g)</Label>
                    <Input type="number" step="0.1" {...register("injection.product_weight_g", { valueAsNumber: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Toplam Yolluk Ağırlığı (Baskı Başına - g)</Label>
                    <Input type="number" step="0.1" {...register("injection.runner_sprue_weight_g", { valueAsNumber: true })} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Fire/Kırma Ürünü (Opsiyonel)</Label>
                    <SearchableSelect
                      value={watch("injection.scrap_product_id") || ""}
                      onValueChange={(val) => setValue("injection.scrap_product_id", val)}
                      options={scrapProducts.map(p => ({ 
                        value: p.id, 
                        label: `${p.name} (${p.code})`, 
                        searchString: p.code 
                      }))}
                      placeholder="Ürün seçiniz"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reçete İçeriği (Hammadde Listesi) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Reçete İçeriği (Hammaddeler)</CardTitle>
              <Button type="button" size="sm" variant="secondary" onClick={handleAppendItem}>
                <Plus className="w-4 h-4 mr-2" />
                Hammadde Ekle
              </Button>
            </CardHeader>
            <CardContent>
              {totalTargetWeightKg > 0 && (
                <div className="mb-6 p-4 bg-primary/10 text-primary border border-primary/20 rounded-lg flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm">Ürün Başına Hedef Hammadde Ağırlığı</h4>
                    <p className="text-xs opacity-80 mt-1">
                      Kalıp bilgilerinden hesaplandı: Ürün Ağırlığı + (Yolluk / Göz Sayısı)
                    </p>
                  </div>
                  <div className="text-xl font-bold">
                    {(totalTargetWeightKg * 1000).toFixed(1)} g <span className="text-sm font-normal opacity-80">({totalTargetWeightKg.toFixed(4)} KG)</span>
                  </div>
                </div>
              )}

              {errors.items && typeof errors.items.message === 'string' && (
                <p className="text-xs text-danger mb-4">{errors.items.message}</p>
              )}
              
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-4 p-4 border rounded-lg bg-card relative">
                    <div className="flex-1 grid grid-cols-12 gap-4">
                      
                      <div className="col-span-5 space-y-2">
                        <Label>Hammadde / Yarı Mamul *</Label>
                        <SearchableSelect
                          value={watch(`items.${index}.component_product_id`)}
                          onValueChange={(val) => setValue(`items.${index}.component_product_id`, val)}
                          options={componentProducts.map(p => ({ 
                            value: p.id, 
                            label: `${p.name} (${p.code})`, 
                            searchString: p.code 
                          }))}
                          placeholder="Seçiniz"
                          className={errors?.items?.[index]?.component_product_id ? "border-danger" : ""}
                        />
                      </div>

                      <div className="col-span-3 space-y-2">
                        <Label>Kullanım Oranı (%)</Label>
                        <Input 
                          type="number" 
                          step="0.1" 
                          {...register(`items.${index}.ratio_pct`, { 
                            valueAsNumber: true,
                            onChange: (e) => {
                              const val = parseFloat(e.target.value) || 0;
                              handleRatioChange(index, val);
                            }
                          })} 
                        />
                      </div>

                      <div className="col-span-2 space-y-2">
                        <Label>Miktar</Label>
                        <Input type="number" step="0.1" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
                      </div>

                      <div className="col-span-2 space-y-2">
                        <Label>Birim</Label>
                        <Select 
                          value={watch(`items.${index}.unit`)} 
                          onValueChange={(val) => setValue(`items.${index}.unit`, val as BomFormInput["items"][number]["unit"])}
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {watch(`items.${index}.unit`) === "kg" && "KG"}
                              {watch(`items.${index}.unit`) === "adet" && "Adet"}
                              {watch(`items.${index}.unit`) === "metre" && "Metre"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kg">KG</SelectItem>
                            <SelectItem value="adet">Adet</SelectItem>
                            <SelectItem value="metre">Metre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="mt-6 text-danger hover:text-danger hover:bg-danger/10"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                
                {fields.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    Reçeteye henüz hammadde eklenmedi.
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
