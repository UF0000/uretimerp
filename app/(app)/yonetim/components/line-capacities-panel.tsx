"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { addLineCapacity, setLineCapacityActive, type CapacitySettings } from "@/app/actions/admin/capacity";
import { lineCapacitySchema, type LineCapacityFormValues } from "@/lib/validations/capacity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDate, formatTR } from "@/lib/format";
import { getErrorMessage } from "@/lib/utils";

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
const nullIfEmpty = (v: string) => (v === "" ? null : v);

export function LineCapacitiesPanel({ lines, capacities }: { lines: CapacitySettings["lines"]; capacities: CapacitySettings["lineCapacities"] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);
  const now = today();

  const isCurrent = (c: CapacitySettings["lineCapacities"][number]) =>
    c.active && c.valid_from <= now && (!c.valid_to || c.valid_to >= now);
  const withoutCurrent = lines.filter((l) => !capacities.some((c) => c.line_id === l.id && isCurrent(c)));

  const rows = [...capacities].sort(
    (a, b) =>
      (lineById.get(a.line_id)?.code ?? "").localeCompare(lineById.get(b.line_id)?.code ?? "") ||
      b.valid_from.localeCompare(a.valid_from),
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LineCapacityFormValues>({
    resolver: zodResolver(lineCapacitySchema),
    defaultValues: { line_id: "", valid_from: now, valid_to: null, note: null },
  });

  const onSubmit = async (values: LineCapacityFormValues) => {
    try {
      await addLineCapacity(values);
      reset({ line_id: values.line_id, valid_from: now, valid_to: null, note: null });
      toast.success("Kapasite eklendi", { description: "Varsa önceki açık dönem bir gün öncesinde bitirildi." });
    } catch (error) {
      toast.error("Eklenemedi", { description: getErrorMessage(error) });
    }
  };

  const toggle = async (id: string, active: boolean) => {
    try {
      setBusy(id);
      await setLineCapacityActive(id, active);
      toast.success(active ? "Kapasite kaydı aktif edildi" : "Kapasite kaydı pasife alındı");
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
        Makinenin saatlik üretim kapasitesi (kg/saat). Kapasite değişince yeni kayıt ekleyin; eski dönem otomatik bitirilir
        ve geçmiş analizler o tarihteki kapasiteyle hesaplanır.
      </p>

      {withoutCurrent.length > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          Bugün geçerli kapasitesi olmayan makineler: {withoutCurrent.map((l) => l.code).join(", ")}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-1 lg:col-span-2">
          <Label>Makine</Label>
          <Controller
            control={control}
            name="line_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                <SelectTrigger className={errors.line_id ? "w-full border-danger" : "w-full"}>
                  <SelectValue>{field.value ? `${lineById.get(field.value)?.code} — ${lineById.get(field.value)?.name}` : "Makine seçin"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {lines.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.code} — {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.line_id && <p className="text-xs text-danger">{errors.line_id.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="cap_kg">Kapasite (kg/saat)</Label>
          <Input id="cap_kg" type="number" step="0.001" placeholder="Örn: 345" {...register("capacity_kg_per_hour", { valueAsNumber: true })} className={errors.capacity_kg_per_hour ? "border-danger" : ""} />
          {errors.capacity_kg_per_hour && <p className="text-xs text-danger">{errors.capacity_kg_per_hour.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="cap_from">Başlangıç</Label>
          <Input id="cap_from" type="date" {...register("valid_from")} className={errors.valid_from ? "border-danger" : ""} />
          {errors.valid_from && <p className="text-xs text-danger">{errors.valid_from.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="cap_to">Bitiş (boş = devam)</Label>
          <Input id="cap_to" type="date" {...register("valid_to", { setValueAs: nullIfEmpty })} className={errors.valid_to ? "border-danger" : ""} />
          {errors.valid_to && <p className="text-xs text-danger">{errors.valid_to.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="cap_note">Not</Label>
          <Input id="cap_note" placeholder="Örn: vida değişimi" {...register("note", { setValueAs: nullIfEmpty })} />
        </div>
        <div className="sm:col-span-2 lg:col-span-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Kapasite ekle
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 font-medium">Makine</th>
              <th className="px-3 py-2 text-right font-medium">Kapasite</th>
              <th className="px-3 py-2 font-medium">Başlangıç</th>
              <th className="px-3 py-2 font-medium">Bitiş</th>
              <th className="px-3 py-2 font-medium">Not</th>
              <th className="px-3 py-2 font-medium">Aktif</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Henüz kapasite kaydı yok.
                </td>
              </tr>
            )}
            {rows.map((c) => {
              const line = lineById.get(c.line_id);
              return (
                <tr key={c.id} className={c.active ? "border-b border-border last:border-0" : "border-b border-border text-muted-foreground last:border-0"}>
                  <td className="px-3 py-2">
                    <span className="font-medium">{line?.code}</span> <span className="text-muted-foreground">{line?.name}</span>{" "}
                    {isCurrent(c) && <Badge variant="outline">Bugün geçerli</Badge>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatTR(c.capacity_kg_per_hour, 1)} kg/sa</td>
                  <td className="px-3 py-2">{formatDate(c.valid_from)}</td>
                  <td className="px-3 py-2">{c.valid_to ? formatDate(c.valid_to) : "devam ediyor"}</td>
                  <td className="px-3 py-2 text-xs">{c.note}</td>
                  <td className="px-3 py-2">
                    <Switch checked={c.active} disabled={busy === c.id} aria-label="Kapasite kaydı aktif" onCheckedChange={(v) => toggle(c.id, v)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
