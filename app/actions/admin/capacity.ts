"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import {
  holidaySchema,
  lineCapacitySchema,
  referenceCapacitySchema,
  weeklyOffDaysSchema,
  type HolidayFormValues,
  type LineCapacityFormValues,
  type ReferenceCapacityFormValues,
} from "@/lib/validations/capacity";
import { compareMaterialGroups, compareReferenceCapacities } from "@/lib/capacity-sort";

const refresh = () => {
  revalidatePath("/yonetim");
  revalidatePath("/ana-veri");
  revalidatePath("/uretim/analiz");
};

const firstIssue = (issues: { message: string }[]) => issues[0]?.message ?? "Geçersiz form verisi.";

export async function getCapacitySettings() {
  await requirePermission("admin:all");
  const supabase = await createClient();
  const [lines, lineCaps, refCaps, holidays, params, groups] = await Promise.all([
    supabase.from("production_lines").select("id, code, name, line_type").order("code"),
    supabase
      .from("line_capacities")
      .select("id, line_id, capacity_kg_per_hour, valid_from, valid_to, note, active")
      .order("valid_from", { ascending: false }),
    supabase
      .from("reference_capacities")
      .select("id, material_group, diameter_mm, sdr, capacity_kg_per_hour, year, source, approval, active")
      .order("material_group")
      .order("diameter_mm")
      .order("sdr")
      .order("year", { ascending: false }),
    supabase.from("calendar_holidays").select("day, name, off_hours").order("day", { ascending: false }),
    supabase.from("cost_parameters").select("weekly_off_days").limit(1).maybeSingle(),
    supabase.from("products").select("material_group").not("material_group", "is", null),
  ]);
  for (const res of [lines, lineCaps, refCaps, holidays, params, groups]) {
    if (res.error) throw new Error("Kapasite ayarları getirilirken hata oluştu: " + res.error.message);
  }

  return {
    lines: lines.data ?? [],
    lineCapacities: (lineCaps.data ?? []).map((c) => ({ ...c, capacity_kg_per_hour: Number(c.capacity_kg_per_hour) })),
    referenceCapacities: (refCaps.data ?? [])
      .map((r) => ({
        ...r,
        diameter_mm: Number(r.diameter_mm),
        sdr: r.sdr === null ? null : Number(r.sdr),
        capacity_kg_per_hour: Number(r.capacity_kg_per_hour),
      }))
      .sort(compareReferenceCapacities),
    holidays: (holidays.data ?? []).map((h) => ({ ...h, off_hours: Number(h.off_hours) })),
    weeklyOffDays: params.data?.weekly_off_days ?? [],
    materialGroups: [...new Set((groups.data ?? []).map((g) => g.material_group!).filter(Boolean))].sort(compareMaterialGroups),
  };
}

export type CapacitySettings = Awaited<ReturnType<typeof getCapacitySettings>>;

const dayBefore = (isoDate: string) => new Date(Date.parse(isoDate + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);

/**
 * Yeni kapasite dönemi ekler. Aynı makinede bu tarihten önce başlamış ve hâlâ
 * açık olan dönem varsa bir gün öncesinde otomatik bitirilir; diğer çakışmaları
 * veritabanı reddeder.
 */
export async function addLineCapacity(values: LineCapacityFormValues) {
  await requirePermission("admin:all");
  const parsed = lineCapacitySchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssue(parsed.error.issues));
  const v = parsed.data;
  const supabase = await createClient();

  const { data: open, error: openError } = await supabase
    .from("line_capacities")
    .select("id")
    .eq("line_id", v.line_id)
    .eq("active", true)
    .lt("valid_from", v.valid_from)
    .or(`valid_to.is.null,valid_to.gte.${v.valid_from}`);
  if (openError) throw new Error(openError.message);
  if (open.length) {
    const { error } = await supabase.from("line_capacities").update({ valid_to: dayBefore(v.valid_from) }).in("id", open.map((o) => o.id));
    if (error) throw new Error(error.message);
  }

  const { error } = await supabase.from("line_capacities").insert({ ...v, note: v.note || null });
  if (error) throw new Error(error.message);
  refresh();
}

/** Kapasite kaydını pasife alır / yeniden aktifler (silme yok; geçmiş analizler için iz kalır). */
export async function setLineCapacityActive(id: string, active: boolean) {
  await requirePermission("admin:all");
  const supabase = await createClient();
  const { error } = await supabase.from("line_capacities").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function saveReferenceCapacity(values: ReferenceCapacityFormValues) {
  await requirePermission("admin:all");
  const parsed = referenceCapacitySchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssue(parsed.error.issues));
  const { id, ...v } = parsed.data;
  const row = { ...v, material_group: v.material_group.toUpperCase(), source: v.source || null };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("reference_capacities").update(row).eq("id", id)
    : await supabase.from("reference_capacities").insert(row);
  if (error) {
    if (error.code === "23505") throw new Error("Bu grup, çap, SDR ve yıl için zaten bir referans kaydı var.");
    throw new Error(error.message);
  }
  refresh();
}

export async function setReferenceCapacityActive(id: string, active: boolean) {
  await requirePermission("admin:all");
  const supabase = await createClient();
  const { error } = await supabase.from("reference_capacities").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function saveHoliday(values: HolidayFormValues) {
  await requirePermission("admin:all");
  const parsed = holidaySchema.safeParse(values);
  if (!parsed.success) throw new Error(firstIssue(parsed.error.issues));
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_holidays").upsert(parsed.data, { onConflict: "day" });
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteHoliday(day: string) {
  await requirePermission("admin:all");
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_holidays").delete().eq("day", day);
  if (error) throw new Error(error.message);
  refresh();
}

export async function saveWeeklyOffDays(days: number[]) {
  await requirePermission("admin:all");
  const parsed = weeklyOffDaysSchema.safeParse(days);
  if (!parsed.success) throw new Error("Geçersiz gün seçimi.");
  const weekly_off_days = [...new Set(parsed.data)].sort();
  const supabase = await createClient();
  const { data: existing } = await supabase.from("cost_parameters").select("id").limit(1).maybeSingle();
  const { error } = existing
    ? await supabase.from("cost_parameters").update({ weekly_off_days }).eq("id", existing.id)
    : await supabase.from("cost_parameters").insert({ weekly_off_days });
  if (error) throw new Error(error.message);
  refresh();
}
