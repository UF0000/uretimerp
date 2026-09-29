"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  productionEntrySchema,
  ProductionEntryFormInput,
  ProductionEntryFormValues,
} from "@/lib/validations/production";
import { recordProductionEntry } from "@/app/actions/production";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/shared/searchable-select";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, getErrorMessage, one } from "@/lib/utils";
import { formatTR } from "@/lib/format";
import type { WorkOrderRow } from "@/app/actions/work-orders";
import type { RawLot } from "@/app/actions/production";

type Option = { id: string; code: string; name?: string; label?: string };

interface ProductionEntryModalProps {
  workOrder: WorkOrderRow | null;
  isOpen: boolean;
  onClose: () => void;
  scrapProducts: Option[];
  /** Mamulün girebileceği depolar (type = finished) */
  targetWarehouses: { id: string; name: string }[];
  scrapReasons: Option[];
  downtimeReasons: Option[];
  /** Hammadde depolarındaki lotlar (FIFO sıralı) */
  rawLots: RawLot[];
}

/** Sayı alanı: boş bırakılınca 0 (veya null) olur, NaN forma girmez. */
const num = (fallback: number | null) => ({
  setValueAs: (v: string) => (v === "" || v === null ? fallback : Number(v)),
});

export function ProductionEntryModal({
  workOrder,
  isOpen,
  onClose,
  scrapProducts,
  targetWarehouses,
  scrapReasons,
  downtimeReasons,
  rawLots,
}: ProductionEntryModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProductionEntryFormInput, unknown, ProductionEntryFormValues>({
    resolver: zodResolver(productionEntrySchema),
  });

  // Toplamlar (önceki vardiyalar)
  const entries = workOrder?.entries ?? [];
  const producedSoFar = entries.reduce((s, e) => s + Number(e.produced_qty || 0), 0);
  const planned = Number(workOrder?.planned_qty || 0);
  const remaining = Math.max(0, planned - producedSoFar);

  useEffect(() => {
    if (!workOrder) return;
    const bom = one(workOrder.bom);
    const inj = one(bom?.bom_injection);
    const ext = one(bom?.bom_extrusion);
    reset({
      work_order_id: workOrder.id,
      shift: "day",
      operator: "",
      produced_qty: 0,
      total_used_kg: 0,
      scrap_kg: 0,
      scrap_product_id: (bom?.production_type === "injection" ? inj?.scrap_product_id : ext?.scrap_product_id) ?? "",
      scrap_reason_code_id: "",
      downtime_min: 0,
      downtime_reason_code_id: "",
      actual_cycle_time_sec: inj?.cycle_time_sec ? Number(inj.cycle_time_sec) : null,
      target_warehouse_id: targetWarehouses[0]?.id ?? "",
      close_work_order: false,
      raw_lots: {},
    });
  }, [workOrder, reset, targetWarehouses]);

  const produced = Number(watch("produced_qty")) || 0;
  const used = Number(watch("total_used_kg")) || 0;
  const scrapKg = Number(watch("scrap_kg")) || 0;
  const downtime = Number(watch("downtime_min")) || 0;
  const scrapRate = used > 0 ? (scrapKg / used) * 100 : 0;
  const bomItems = (one(workOrder?.bom)?.items ?? []).filter((i) => Number(i.ratio_pct) > 0);
  const rawLotSelection = watch("raw_lots") ?? {};
  const unitWeight = produced > 0 ? Math.max(0, used - scrapKg) / produced : 0;

  const onSubmit = async (data: ProductionEntryFormValues) => {
    try {
      setIsSubmitting(true);
      const { lotNo, moldShots, closed } = await recordProductionEntry(data);
      const parts = [
        lotNo ? `Lot: ${lotNo}` : "Stok hareketi yok (sadece duruş)",
        moldShots > 0 ? `Kalıp sayacı +${formatTR(moldShots, 0)} atış` : null,
        closed ? "İş emri kapatıldı" : null,
      ].filter(Boolean);
      toast.success("Vardiya girişi kaydedildi.", { description: parts.join(" · ") });
      onClose();
    } catch (error) {
      toast.error("Kaydedilemedi", { description: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!workOrder) return null;
  const unit = workOrder.product?.unit ?? "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vardiya Üretim Girişi</DialogTitle>
          <DialogDescription>
            <strong>{workOrder.no}</strong> · {workOrder.product?.code} — şimdiye kadar{" "}
            {formatTR(producedSoFar, 0)} / {formatTR(planned, 0)} {unit} ({entries.length} giriş)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vardiya *</Label>
              <Select
                value={watch("shift")}
                onValueChange={(val) => setValue("shift", val as ProductionEntryFormInput["shift"])}
              >
                <SelectTrigger>
                  <SelectValue>{watch("shift") === "night" ? "Gece" : "Gündüz"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Gündüz</SelectItem>
                  <SelectItem value="night">Gece</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operatör</Label>
              <Input {...register("operator")} placeholder="İsim soyisim" />
            </div>
          </div>

          {/* Üretim */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sağlam Üretim ({unit})</Label>
              <Input
                type="number"
                step="0.001"
                {...register("produced_qty", num(0))}
                className={errors.produced_qty ? "border-danger" : ""}
              />
              {remaining > 0 && (
                <p className="text-xs text-muted-foreground">Kalan: {formatTR(remaining, 0)} {unit}</p>
              )}
              {errors.produced_qty && <p className="text-xs text-danger">{errors.produced_qty.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Kullanılan Hammadde (kg)</Label>
              <Input
                type="number"
                step="0.001"
                {...register("total_used_kg", num(0))}
                className={errors.total_used_kg ? "border-danger" : ""}
              />
              {errors.total_used_kg && <p className="text-xs text-danger">{errors.total_used_kg.message}</p>}
            </div>
          </div>

          {produced > 0 && (
            <div className="space-y-2">
              <Label>Mamulün Gireceği Depo *</Label>
              <Select
                value={watch("target_warehouse_id") || ""}
                onValueChange={(val) => setValue("target_warehouse_id", val ?? "", { shouldValidate: true })}
              >
                <SelectTrigger className={errors.target_warehouse_id ? "border-danger" : ""}>
                  <SelectValue placeholder="Depo seçin">
                    {targetWarehouses.find((w) => w.id === watch("target_warehouse_id"))?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {targetWarehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.target_warehouse_id && <p className="text-xs text-danger">{errors.target_warehouse_id.message}</p>}
            </div>
          )}

          {/* Reçine lotları: kesin izlenebilirlik */}
          {used > 0 && bomItems.length > 0 && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div>
                <Label>Tüketilen Hammadde Lotları</Label>
                <p className="text-xs text-muted-foreground">
                  İsteğe bağlı; seçilirse bu vardiyanın ürünleri hangi reçine lotundan geldiğiyle kesin izlenir.
                </p>
              </div>
              {bomItems.map((item) => {
                const product = one(item.product);
                const need = (used * Number(item.ratio_pct)) / 100;
                const lots = rawLots.filter((l) => l.productId === item.component_product_id);
                const selected = rawLotSelection[item.component_product_id] ?? "";
                const selectedLot = lots.find((l) => l.lotNo === selected);
                return (
                  <div key={item.component_product_id} className="space-y-1">
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="font-medium">{product?.code}</span>
                      <span className="text-muted-foreground">Bu vardiya: {formatTR(need, 2)} kg</span>
                    </div>
                    <Select
                      value={selected}
                      onValueChange={(val) =>
                        setValue("raw_lots", { ...rawLotSelection, [item.component_product_id]: val ?? "" })
                      }
                      disabled={lots.length === 0}
                    >
                      <SelectTrigger className={cn(selectedLot && selectedLot.qty < need && "border-danger")}>
                        <SelectValue placeholder={lots.length === 0 ? "Lotlu stok yok" : "Lot seçilmedi"}>
                          {selectedLot ? `${selectedLot.lotNo} (${formatTR(selectedLot.qty, 2)} kg)` : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Lot seçilmedi</SelectItem>
                        {lots.map((l, i) => (
                          <SelectItem key={l.lotNo} value={l.lotNo}>
                            {l.lotNo} — {formatTR(l.qty, 2)} kg{i === 0 ? " (en eski)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedLot && selectedLot.qty < need && (
                      <p className="text-xs text-danger">Bu lotta yeterli miktar yok ({formatTR(selectedLot.qty, 2)} kg).</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Fire */}
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="space-y-2">
              <Label>Fire (kg)</Label>
              <Input
                type="number"
                step="0.001"
                {...register("scrap_kg", num(0))}
                className={errors.scrap_kg ? "border-danger" : ""}
              />
              {errors.scrap_kg && <p className="text-xs text-danger">{errors.scrap_kg.message}</p>}
            </div>
            {scrapKg > 0 && (
              <>
                <div className="space-y-2">
                  <Label>Fire Nedeni *</Label>
                  <SearchableSelect
                    value={watch("scrap_reason_code_id") || ""}
                    onValueChange={(val) => setValue("scrap_reason_code_id", val, { shouldValidate: true })}
                    options={scrapReasons.map((r) => ({ value: r.id, label: `${r.code} - ${r.label}`, searchString: r.code }))}
                    placeholder="Neden kodu seçin"
                    className={errors.scrap_reason_code_id ? "border-danger" : ""}
                  />
                  {errors.scrap_reason_code_id && <p className="text-xs text-danger">{errors.scrap_reason_code_id.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Fire Hangi Hurda Ürününe İşlensin? *</Label>
                  <SearchableSelect
                    value={watch("scrap_product_id") || ""}
                    onValueChange={(val) => setValue("scrap_product_id", val, { shouldValidate: true })}
                    options={scrapProducts.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}`, searchString: p.code }))}
                    placeholder="Hurda ürünü seçin"
                    className={errors.scrap_product_id ? "border-danger" : ""}
                  />
                  {errors.scrap_product_id && <p className="text-xs text-danger">{errors.scrap_product_id.message}</p>}
                </div>
              </>
            )}
          </div>

          {/* Duruş + çevrim */}
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duruş (dk)</Label>
                <Input
                  type="number"
                  step="1"
                  {...register("downtime_min", num(0))}
                  className={errors.downtime_min ? "border-danger" : ""}
                />
                {errors.downtime_min && <p className="text-xs text-danger">{errors.downtime_min.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Gerçek Çevrim (sn)</Label>
                <Input type="number" step="0.001" {...register("actual_cycle_time_sec", num(null))} />
                {errors.actual_cycle_time_sec && <p className="text-xs text-danger">{errors.actual_cycle_time_sec.message}</p>}
              </div>
            </div>
            {downtime > 0 && (
              <div className="space-y-2">
                <Label>Duruş Nedeni *</Label>
                <SearchableSelect
                  value={watch("downtime_reason_code_id") || ""}
                  onValueChange={(val) => setValue("downtime_reason_code_id", val, { shouldValidate: true })}
                  options={downtimeReasons.map((r) => ({ value: r.id, label: `${r.code} - ${r.label}`, searchString: r.code }))}
                  placeholder="Neden kodu seçin"
                  className={errors.downtime_reason_code_id ? "border-danger" : ""}
                />
                {errors.downtime_reason_code_id && <p className="text-xs text-danger">{errors.downtime_reason_code_id.message}</p>}
              </div>
            )}
          </div>

          <div className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ortalama birim ağırlık:</span>
              <span className="font-medium">{formatTR(unitWeight, 3)} kg/{unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fire oranı:</span>
              <span className={cn("font-medium", scrapRate > 10 && "text-danger")}>%{formatTR(scrapRate, 1)}</span>
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <span className="text-sm">
              <span className="font-medium">Bu girişle iş emrini kapat</span>
              <span className="block text-xs text-muted-foreground">Kapatılan iş emrine yeni giriş yapılamaz.</span>
            </span>
            <Switch
              checked={Boolean(watch("close_work_order"))}
              onCheckedChange={(val) => setValue("close_work_order", val)}
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {watch("close_work_order") ? "Kaydet ve Kapat" : "Vardiyayı Kaydet"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
