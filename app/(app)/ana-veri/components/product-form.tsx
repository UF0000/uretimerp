"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { saveProduct } from "@/app/actions/master-data/products";
import { ProductFormValues, ProductFormInput, productSchema } from "@/lib/validations/master-data";
import { CATEGORY_LABELS, PRODUCT_TYPE_LABELS, PRODUCT_TYPES, groupCodeFromCode, variantBaseFromCode, type ProductType } from "@/lib/product-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/utils";

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: ProductFormInput;
  groups: { code: string; name: string }[];
}

const EMPTY: ProductFormInput = {
  code: "",
  name: "",
  type: "finished",
  unit: "adet",
  category: "",
  material_grade: "",
  material_group: "",
  diameter_mm: null,
  sdr: null,
  wall_thickness_mm: null,
  group_code: "",
  variant_code: "",
  description: "",
  min_stock: 0,
  critical_stock: 0,
};

const numberOrNull = (v: string) => (v === "" || v === null ? null : Number(v));
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="border-b border-border pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
);

export function ProductForm({ open, onOpenChange, initialData, groups }: ProductFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: initialData || EMPTY,
  });

  const [type, unit, category, code] = useWatch({ control, name: ["type", "unit", "category", "code"] });
  const isMaterial = type === "raw" || type === "regrind" || type === "scrap";
  const hasDimensions = category === "boru" || category === "baglanti_parcasi" || type === "finished" || type === "semi";
  const suggestedGroup = code ? groupCodeFromCode(code) : null;
  const suggestedVariant = code ? variantBaseFromCode(code) : null;

  const onSubmit = async (data: ProductFormValues) => {
    try {
      setIsSubmitting(true);
      await saveProduct(data);
      toast.success(initialData ? "Ürün güncellendi" : "Ürün eklendi");
      onOpenChange(false);
      reset(EMPTY);
    } catch (error) {
      toast.error("Hata oluştu", { description: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{initialData ? "Ürün Düzenle" : "Yeni Ürün Ekle"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2">
          <SectionTitle>Temel bilgiler</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Stok kodu *</Label>
              <Input id="code" {...register("code")} className={errors.code ? "border-danger" : ""} />
              {errors.code && <p className="text-xs text-danger">{errors.code.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Adı *</Label>
              <Input id="name" {...register("name")} className={errors.name ? "border-danger" : ""} />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Ürün türü *</Label>
              <Select value={type} onValueChange={(val) => val && setValue("type", val as ProductType, { shouldDirty: true })}>
                <SelectTrigger className="w-full">
                  <SelectValue>{PRODUCT_TYPE_LABELS[type as ProductType]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {PRODUCT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Birim *</Label>
              <Select value={unit} onValueChange={(val) => val && setValue("unit", val as ProductFormInput["unit"], { shouldDirty: true })}>
                <SelectTrigger className="w-full">
                  <SelectValue>{unit === "adet" ? "Adet" : unit === "kg" ? "Kg" : "Metre"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adet">Adet</SelectItem>
                  <SelectItem value="kg">Kg</SelectItem>
                  <SelectItem value="metre">Metre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ürün ailesi</Label>
              <Select value={category || ""} onValueChange={(val) => setValue("category", val ?? "", { shouldDirty: true })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seçiniz">{category ? CATEGORY_LABELS[category] : "Seçiniz"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Boru ve fitting kartında farklı teknik alanlar görünür</p>
            </div>
            {isMaterial && (
              <div className="space-y-2">
                <Label htmlFor="material_grade">Malzeme grade</Label>
                <Input id="material_grade" {...register("material_grade")} placeholder="Örn: PE100" />
              </div>
            )}
          </div>

          <SectionTitle>Gruplama ve varyant</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="group_code">Grup kodu</Label>
              <div className="flex gap-2">
                <Input id="group_code" list="product-group-codes" placeholder="Örn: 03" {...register("group_code")} />
                {suggestedGroup && (
                  <Button type="button" variant="outline" size="icon" title={`Koddan al: ${suggestedGroup}`} onClick={() => setValue("group_code", suggestedGroup, { shouldDirty: true })}>
                    <Wand2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <datalist id="product-group-codes">
                {groups.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.name}
                  </option>
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">Ürün türü grubu (ör. 03); stok kodundan bağımsız</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="variant_code">Genel stok kodu (varyant)</Label>
              <div className="flex gap-2">
                <Input id="variant_code" placeholder="Örn: 1A012020" {...register("variant_code")} />
                {suggestedVariant && (
                  <Button type="button" variant="outline" size="icon" title={`Kurala göre: ${suggestedVariant}`} onClick={() => setValue("variant_code", suggestedVariant, { shouldDirty: true })}>
                    <Wand2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Aynı genel kodu taşıyan ürünler birbirinin varyantıdır</p>
            </div>
          </div>

          {hasDimensions && (
            <>
              <SectionTitle>Boyut / ebat</SectionTitle>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="material_group">Malzeme grubu</Label>
                  <Input id="material_group" list="product-material-groups" placeholder="PE" {...register("material_group")} />
                  <datalist id="product-material-groups">
                    <option value="PE" />
                    <option value="PP/PPR" />
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diameter_mm">Çap (mm)</Label>
                  <Input id="diameter_mm" type="number" step="any" {...register("diameter_mm", { setValueAs: numberOrNull })} className={errors.diameter_mm ? "border-danger" : ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wall_thickness_mm">Et kalınlığı (mm)</Label>
                  <Input id="wall_thickness_mm" type="number" step="any" {...register("wall_thickness_mm", { setValueAs: numberOrNull })} className={errors.wall_thickness_mm ? "border-danger" : ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sdr">SDR</Label>
                  <Input id="sdr" type="number" step="any" {...register("sdr", { setValueAs: numberOrNull })} className={errors.sdr ? "border-danger" : ""} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Ağırlık, üretim hızı ve çevrim süresi ürün detay sayfasından reçete/kalıpla birlikte düzenlenir.</p>
            </>
          )}

          <SectionTitle>Stok sınırları</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_stock">Min. stok (uyarı)</Label>
              <Input id="min_stock" type="number" step="any" {...register("min_stock", { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="critical_stock">Kritik stok (acil)</Label>
              <Input id="critical_stock" type="number" step="any" {...register("critical_stock", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Açıklama</Label>
            <Textarea id="description" rows={2} {...register("description")} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
