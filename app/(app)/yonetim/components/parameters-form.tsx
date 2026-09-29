"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveParameters } from "@/app/actions/admin";
import { parametersSchema, ParametersFormValues } from "@/lib/validations/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/utils";

const FIELDS: { name: keyof ParametersFormValues; label: string; hint: string; step: string }[] = [
  { name: "labor_per_unit", label: "İşçilik (₺ / birim)", hint: "Üretilen her birim için işçilik maliyeti", step: "0.001" },
  { name: "energy_per_unit", label: "Enerji (₺ / birim)", hint: "Üretilen her birim için enerji maliyeti", step: "0.001" },
  { name: "overhead_pct", label: "Genel gider (%)", hint: "Hammadde + işçilik + enerji üzerine eklenir", step: "0.001" },
  { name: "usd_rate", label: "USD kuru (₺)", hint: "USD fiyatlı malzemelerin TL karşılığı", step: "0.001" },
  { name: "eur_rate", label: "EUR kuru (₺)", hint: "EUR fiyatlı malzemelerin TL karşılığı", step: "0.001" },
  { name: "shift_minutes", label: "Vardiya süresi (dk)", hint: "OEE kullanılabilirlik hesabında planlı süre", step: "1" },
  { name: "target_scrap_pct", label: "Fire hedefi (%)", hint: "Bu değerin üstü hedef dışı sayılır", step: "0.001" },
  { name: "overweight_tolerance_pct", label: "Overweight toleransı (±%)", hint: "Metre/parça ağırlığı sapma sınırı", step: "0.001" },
  { name: "target_oee_pct", label: "OEE hedefi (%)", hint: "Üretim analizinde OEE değerlendirmesi", step: "1" },
];

export function ParametersForm({ initial }: { initial: ParametersFormValues }) {
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ParametersFormValues>({ resolver: zodResolver(parametersSchema), defaultValues: initial });

  const onSubmit = async (values: ParametersFormValues) => {
    try {
      setSaving(true);
      await saveParameters(values);
      reset(values);
      toast.success("Parametreler kaydedildi", { description: "Maliyet ve OEE raporları yeni değerlerle hesaplanır." });
    } catch (error) {
      toast.error("Kaydedilemedi", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.name} className="space-y-1">
            <Label htmlFor={f.name}>{f.label}</Label>
            <Input
              id={f.name}
              type="number"
              step={f.step}
              {...register(f.name, { valueAsNumber: true })}
              className={errors[f.name] ? "border-danger" : ""}
            />
            {errors[f.name] ? (
              <p className="text-xs text-danger">{errors[f.name]?.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            )}
          </div>
        ))}
      </div>
      <Button type="submit" disabled={saving || !isDirty}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Parametreleri Kaydet
      </Button>
    </form>
  );
}
