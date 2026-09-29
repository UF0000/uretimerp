"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { saveReferenceCapacity, setReferenceCapacityActive, type CapacitySettings } from "@/app/actions/admin/capacity";
import { referenceCapacitySchema, type ReferenceCapacityFormValues } from "@/lib/validations/capacity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatTR } from "@/lib/format";
import { getErrorMessage } from "@/lib/utils";

type Row = CapacitySettings["referenceCapacities"][number];

const APPROVAL_LABELS = { approved: "Onaylı", pending: "Onay bekliyor" } as const;
const nullIfEmpty = (v: string) => (v === "" ? null : v);
const numberOrNull = (v: string) => (v === "" || v === null ? null : Number(v));

const emptyForm = (): ReferenceCapacityFormValues => ({
  material_group: "",
  diameter_mm: Number.NaN,
  sdr: null,
  capacity_kg_per_hour: Number.NaN,
  year: new Date().getFullYear(),
  source: null,
  approval: "approved",
});

export function ReferenceCapacitiesPanel({ rows, materialGroups }: { rows: Row[]; materialGroups: string[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string>("");
  const groups = [...new Set([...materialGroups, ...rows.map((r) => r.material_group)])].sort();
  const visible = groupFilter ? rows.filter((r) => r.material_group === groupFilter) : rows;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReferenceCapacityFormValues>({ resolver: zodResolver(referenceCapacitySchema), defaultValues: emptyForm() });
  const editingId = useWatch({ control, name: "id" });

  const onSubmit = async (values: ReferenceCapacityFormValues) => {
    try {
      await saveReferenceCapacity(values);
      reset({ ...emptyForm(), material_group: values.material_group, year: values.year });
      toast.success(values.id ? "Referans kapasite güncellendi" : "Referans kapasite eklendi");
    } catch (error) {
      toast.error("Kaydedilemedi", { description: getErrorMessage(error) });
    }
  };

  const edit = (r: Row) => {
    reset({
      id: r.id,
      material_group: r.material_group,
      diameter_mm: r.diameter_mm,
      sdr: r.sdr,
      capacity_kg_per_hour: r.capacity_kg_per_hour,
      year: r.year,
      source: r.source,
      approval: r.approval === "pending" ? "pending" : "approved",
    });
  };

  const toggle = async (id: string, active: boolean) => {
    try {
      setBusy(id);
      await setReferenceCapacityActive(id, active);
      toast.success(active ? "Referans aktif edildi" : "Referans pasife alındı");
    } catch (error) {
      toast.error("Değiştirilemedi", { description: getErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Ürünün malzeme grubu, çapı ve SDR&apos;sine göre beklenen üretim hızı (kg/saat). Üretim analizinde &quot;hız
        performansı&quot; bu değerle karşılaştırılır. Aynı ürüne birden çok yıl uyarsa onaylı en güncel yıl kullanılır;
        SDR boş bırakılırsa o çaptaki tüm SDR&apos;lere uyar.
      </p>

      <datalist id="material-groups">
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="ref_group">Malzeme grubu</Label>
          <Input id="ref_group" list="material-groups" placeholder="Örn: PE" {...register("material_group")} className={errors.material_group ? "border-danger" : ""} />
          {errors.material_group && <p className="text-xs text-danger">{errors.material_group.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="ref_dia">Çap (mm)</Label>
          <Input id="ref_dia" type="number" step="0.001" placeholder="Örn: 90" {...register("diameter_mm", { valueAsNumber: true })} className={errors.diameter_mm ? "border-danger" : ""} />
          {errors.diameter_mm && <p className="text-xs text-danger">{errors.diameter_mm.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="ref_sdr">SDR (boş = hepsi)</Label>
          <Input id="ref_sdr" type="number" step="0.001" placeholder="Örn: 11" {...register("sdr", { setValueAs: numberOrNull })} className={errors.sdr ? "border-danger" : ""} />
          {errors.sdr && <p className="text-xs text-danger">{errors.sdr.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="ref_cap">Kapasite (kg/saat)</Label>
          <Input id="ref_cap" type="number" step="0.001" {...register("capacity_kg_per_hour", { valueAsNumber: true })} className={errors.capacity_kg_per_hour ? "border-danger" : ""} />
          {errors.capacity_kg_per_hour && <p className="text-xs text-danger">{errors.capacity_kg_per_hour.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="ref_year">Yıl</Label>
          <Input id="ref_year" type="number" step="1" {...register("year", { valueAsNumber: true })} className={errors.year ? "border-danger" : ""} />
          {errors.year && <p className="text-xs text-danger">{errors.year.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="ref_source">Kaynak</Label>
          <Input id="ref_source" placeholder="Örn: 2026 deneme üretimi" {...register("source", { setValueAs: nullIfEmpty })} />
        </div>
        <div className="space-y-1">
          <Label>Onay</Label>
          <Controller
            control={control}
            name="approval"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{APPROVAL_LABELS[field.value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Onaylı</SelectItem>
                  <SelectItem value="pending">Onay bekliyor</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">Analizde yalnızca onaylılar kullanılır</p>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingId ? "Güncelle" : "Referans ekle"}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={() => reset(emptyForm())}>
              Vazgeç
            </Button>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Grup:</span>
        <Button type="button" size="sm" variant={groupFilter === "" ? "default" : "outline"} onClick={() => setGroupFilter("")}>
          Tümü ({rows.length})
        </Button>
        {groups
          .filter((g) => rows.some((r) => r.material_group === g))
          .map((g) => (
            <Button key={g} type="button" size="sm" variant={groupFilter === g ? "default" : "outline"} onClick={() => setGroupFilter(g)}>
              {g} ({rows.filter((r) => r.material_group === g).length})
            </Button>
          ))}
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 font-medium">Grup</th>
              <th className="px-3 py-2 text-right font-medium">Çap</th>
              <th className="px-3 py-2 text-right font-medium">SDR</th>
              <th className="px-3 py-2 text-right font-medium">Kapasite</th>
              <th className="px-3 py-2 text-right font-medium">Yıl</th>
              <th className="px-3 py-2 font-medium">Kaynak</th>
              <th className="px-3 py-2 font-medium">Onay</th>
              <th className="px-3 py-2 font-medium">Aktif</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  Henüz referans kapasite yok.
                </td>
              </tr>
            )}
            {visible.map((r) => (
              <tr key={r.id} className={r.active ? "border-b border-border last:border-0" : "border-b border-border text-muted-foreground last:border-0"}>
                <td className="px-3 py-2 font-medium">{r.material_group}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatTR(r.diameter_mm, 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.sdr === null ? "hepsi" : formatTR(r.sdr, 1)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatTR(r.capacity_kg_per_hour, 1)} kg/sa</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.year}</td>
                <td className="px-3 py-2 text-xs">{r.source}</td>
                <td className="px-3 py-2">
                  <Badge variant={r.approval === "approved" ? "outline" : "secondary"}>{r.approval === "approved" ? "Onaylı" : "Onay bekliyor"}</Badge>
                </td>
                <td className="px-3 py-2">
                  <Switch checked={r.active} disabled={busy === r.id} aria-label="Referans aktif" onCheckedChange={(v) => toggle(r.id, v)} />
                </td>
                <td className="px-3 py-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => edit(r)} aria-label="Düzenle">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
