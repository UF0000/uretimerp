"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { saveStockDocument } from "@/app/actions/stock";
import { stockDocumentSchema, StockDocumentFormValues } from "@/lib/validations/stock";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { getErrorMessage } from "@/lib/utils";
import type { ProductRow } from "@/app/actions/master-data/products";
import type { WarehouseRow } from "@/app/actions/master-data/warehouses";
interface StockDocumentFormProps {
  products: ProductRow[];
  warehouses: WarehouseRow[];
}

export function StockDocumentForm({ products, warehouses }: StockDocumentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StockDocumentFormValues>({
    resolver: zodResolver(stockDocumentSchema),
    defaultValues: {
      type: "in_purchase",
      document_date: new Date().toISOString().split("T")[0],
      source_warehouse_id: "",
      target_warehouse_id: "",
      items: [{ product_id: "", quantity: 1, lot_no: "", note: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchType = watch("type");

  // Type related logic
  const isTransfer = watchType === "transfer";
  const isIn = watchType.startsWith("in_");
  const isOut = watchType.startsWith("out_");

  const onSubmit = async (data: StockDocumentFormValues) => {
    try {
      setIsSubmitting(true);
      
      // Additional validations
      if (isTransfer && data.source_warehouse_id === data.target_warehouse_id) {
        toast.error("Kaynak ve Hedef depo aynı olamaz!");
        return;
      }
      
      const id = await saveStockDocument(data);
      toast.success("Fiş kaydedildi; yazdırabilirsiniz.");
      // Kaydedilen fiş yazdırılabilir görünümde açılır
      router.push(`/depo/fisler/${id}`);
    } catch (error) {
      toast.error("Kaydetme başarısız", { description: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* HEADER SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="space-y-2">
          <Label>Fiş Tipi *</Label>
          <Select 
            value={watchType} 
            onValueChange={(val) => {
              setValue("type", val as StockDocumentFormValues["type"]);
              // Reset warehouse selections when type changes
              setValue("source_warehouse_id", "");
              setValue("target_warehouse_id", "");
            }}
          >
            <SelectTrigger className={errors.type ? "border-danger" : ""}>
              <SelectValue placeholder="Seçiniz">
                {watchType === "in_purchase" && "Satınalma Girişi"}
                {watchType === "in_production" && "Üretimden Giriş"}
                {watchType === "in_count" && "Sayım Fazlası (Giriş)"}
                {watchType === "transfer" && "Depolar Arası Transfer"}
                {watchType === "out_sale" && "Satış Çıkışı"}
                {watchType === "out_consumption" && "Sarf / Üretime Çıkış"}
                {watchType === "out_scrap" && "Fire / Hurda Çıkışı"}
                {watchType === "out_count" && "Sayım Eksiği (Çıkış)"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_purchase">Satınalma Girişi</SelectItem>
              <SelectItem value="in_production">Üretimden Giriş</SelectItem>
              <SelectItem value="in_count">Sayım Fazlası (Giriş)</SelectItem>
              <SelectItem value="transfer">Depolar Arası Transfer</SelectItem>
              <SelectItem value="out_sale">Satış Çıkışı</SelectItem>
              <SelectItem value="out_consumption">Sarf / Üretime Çıkış</SelectItem>
              <SelectItem value="out_scrap">Fire / Hurda Çıkışı</SelectItem>
              <SelectItem value="out_count">Sayım Eksiği (Çıkış)</SelectItem>
            </SelectContent>
          </Select>
          {errors.type && <p className="text-xs text-danger">{errors.type.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Tarih *</Label>
          <Input 
            type="date" 
            {...register("document_date")} 
            className={errors.document_date ? "border-danger" : ""} 
          />
          {errors.document_date && <p className="text-xs text-danger">{errors.document_date.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Evrak / Belge No</Label>
          <Input 
            {...register("no")} 
            placeholder="Otomatik Üretilecek..." 
          />
        </div>

        {(isTransfer || isOut) && (
          <div className="space-y-2">
            <Label>Çıkış Deposu *</Label>
            <SearchableSelect
              value={watch("source_warehouse_id") || ""}
              onValueChange={(val) => setValue("source_warehouse_id", val)}
              options={warehouses.map(w => ({ value: w.id, label: w.name }))}
              placeholder="Depo Seçiniz"
            />
          </div>
        )}

        {(isTransfer || isIn) && (
          <div className="space-y-2">
            <Label>Giriş Deposu *</Label>
            <SearchableSelect
              value={watch("target_warehouse_id") || ""}
              onValueChange={(val) => setValue("target_warehouse_id", val)}
              options={warehouses.map(w => ({ value: w.id, label: w.name }))}
              placeholder="Depo Seçiniz"
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Genel Açıklama</Label>
        <Textarea {...register("note")} rows={2} placeholder="Fiş açıklaması..." />
      </div>

      <hr className="my-6" />

      {/* ITEMS SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Fiş Kalemleri</h2>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => append({ product_id: "", quantity: 1, lot_no: "", note: "" })}
          >
            <Plus className="w-4 h-4 mr-2" />
            Satır Ekle
          </Button>
        </div>

        {errors.items?.message && typeof errors.items.message === "string" && (
          <p className="text-sm text-danger">{errors.items.message}</p>
        )}

        <div className="border rounded-md overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[400px]">Ürün *</TableHead>
                <TableHead className="w-[120px]">Miktar *</TableHead>
                <TableHead className="w-[150px]">Parti / Lot No</TableHead>
                <TableHead>Satır Açıklaması</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <SearchableSelect
                      value={watch(`items.${index}.product_id`)}
                      onValueChange={(val) => setValue(`items.${index}.product_id`, val)}
                      options={products.map(p => ({ 
                        value: p.id, 
                        label: `${p.name} (${p.code})`, 
                        searchString: p.code 
                      }))}
                      placeholder="Ürün Seçiniz"
                      className={errors.items?.[index]?.product_id ? "border-danger" : ""}
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="number" 
                      step="any"
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                      className={errors.items?.[index]?.quantity ? "border-danger" : ""}
                    />
                  </TableCell>
                  <TableCell>
                    <Input {...register(`items.${index}.lot_no`)} placeholder="Opsiyonel" />
                  </TableCell>
                  <TableCell>
                    <Input {...register(`items.${index}.note`)} placeholder="Satır notu..." />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="w-4 h-4 text-danger" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => router.push("/depo/fisler")}
        >
          İptal
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Fişi Kaydet
        </Button>
      </div>
    </form>
  );
}
