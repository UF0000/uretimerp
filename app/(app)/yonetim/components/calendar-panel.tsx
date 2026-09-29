"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteHoliday, saveHoliday, saveWeeklyOffDays, type CapacitySettings } from "@/app/actions/admin/capacity";
import { holidaySchema, type HolidayFormValues } from "@/lib/validations/capacity";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatTR } from "@/lib/format";
import { getErrorMessage } from "@/lib/utils";

// Pazartesi'den başlayarak; değerler PostgreSQL dow (0 = Pazar)
const WEEK_DAYS = [
  { dow: 1, label: "Pazartesi" },
  { dow: 2, label: "Salı" },
  { dow: 3, label: "Çarşamba" },
  { dow: 4, label: "Perşembe" },
  { dow: 5, label: "Cuma" },
  { dow: 6, label: "Cumartesi" },
  { dow: 0, label: "Pazar" },
];

const weekdayName = (isoDate: string) => new Date(isoDate + "T12:00:00").toLocaleDateString("tr-TR", { weekday: "long" });

export function CalendarPanel({ weeklyOffDays, holidays }: { weeklyOffDays: number[]; holidays: CapacitySettings["holidays"] }) {
  const [offDays, setOffDays] = useState<number[]>(weeklyOffDays);
  const [savingDays, setSavingDays] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const daysDirty = [...offDays].sort().join() !== [...weeklyOffDays].sort().join();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HolidayFormValues>({ resolver: zodResolver(holidaySchema), defaultValues: { day: "", name: "", off_hours: 24 } });

  const saveDays = async () => {
    try {
      setSavingDays(true);
      await saveWeeklyOffDays(offDays);
      toast.success("Haftalık kapalı günler kaydedildi");
    } catch (error) {
      toast.error("Kaydedilemedi", { description: getErrorMessage(error) });
    } finally {
      setSavingDays(false);
    }
  };

  const onSubmit = async (values: HolidayFormValues) => {
    try {
      await saveHoliday(values);
      reset({ day: "", name: "", off_hours: 24 });
      toast.success("Tatil kaydedildi");
    } catch (error) {
      toast.error("Kaydedilemedi", { description: getErrorMessage(error) });
    }
  };

  const remove = async (day: string) => {
    try {
      setDeleting(day);
      await deleteHoliday(day);
      toast.success("Tatil silindi");
    } catch (error) {
      toast.error("Silinemedi", { description: getErrorMessage(error) });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Kapasite hesabında her gün 24 saat kabul edilir; haftalık kapalı günler ve tatiller bundan düşülür. Böylece
        kapasite verimi ve zaman kullanımı fabrikanın gerçekten çalışabildiği saatlere göre çıkar.
      </p>

      <section className="space-y-3">
        <h3 className="font-medium">Haftalık kapalı günler</h3>
        <div className="flex flex-wrap gap-4">
          {WEEK_DAYS.map((d) => (
            <label key={d.dow} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={offDays.includes(d.dow)}
                onCheckedChange={(checked) => setOffDays((prev) => (checked ? [...prev, d.dow] : prev.filter((x) => x !== d.dow)))}
              />
              {d.label}
            </label>
          ))}
        </div>
        <Button type="button" onClick={saveDays} disabled={savingDays || !daysDirty}>
          {savingDays && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Kapalı günleri kaydet
        </Button>
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">Tatiller ve kapalı günler</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="hol_day">Tarih</Label>
            <Input id="hol_day" type="date" {...register("day")} className={errors.day ? "border-danger" : ""} />
            {errors.day && <p className="text-xs text-danger">{errors.day.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="hol_name">Açıklama</Label>
            <Input id="hol_name" placeholder="Örn: Cumhuriyet Bayramı" {...register("name")} className={errors.name ? "border-danger" : ""} />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="hol_hours">Kapalı saat</Label>
            <Input id="hol_hours" type="number" step="0.001" {...register("off_hours", { valueAsNumber: true })} className={errors.off_hours ? "border-danger" : ""} />
            {errors.off_hours ? (
              <p className="text-xs text-danger">{errors.off_hours.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">24 = tam gün, 12 = yarım gün (arife)</p>
            )}
          </div>
          <div className="flex items-start pt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tatil ekle
            </Button>
          </div>
        </form>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">Tarih</th>
                <th className="px-3 py-2 font-medium">Gün</th>
                <th className="px-3 py-2 font-medium">Açıklama</th>
                <th className="px-3 py-2 text-right font-medium">Kapalı saat</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {holidays.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Henüz tatil girilmemiş.
                  </td>
                </tr>
              )}
              {holidays.map((h) => (
                <tr key={h.day} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{formatDate(h.day)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{weekdayName(h.day)}</td>
                  <td className="px-3 py-2">{h.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatTR(h.off_hours, h.off_hours % 1 ? 1 : 0)} sa</td>
                  <td className="px-3 py-2">
                    <Button type="button" size="sm" variant="ghost" disabled={deleting === h.day} onClick={() => remove(h.day)} aria-label="Tatili sil">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
