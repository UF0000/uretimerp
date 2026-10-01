import { z } from "@/lib/zod";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Maliyet ve üretim parametreleri (cost_parameters tek satır). */
export const parametersSchema = z.object({
  labor_per_unit: z.number().min(0, "Negatif olamaz"),
  energy_per_unit: z.number().min(0, "Negatif olamaz"),
  overhead_pct: z.number().min(0, "Negatif olamaz").max(100, "En fazla %100"),
  usd_rate: z.number().positive("Kur 0'dan büyük olmalıdır"),
  eur_rate: z.number().positive("Kur 0'dan büyük olmalıdır"),
  shift_minutes: z.number().int("Tam sayı girin").min(60, "En az 60 dk").max(1440, "En fazla 1440 dk"),
  target_scrap_pct: z.number().min(0, "Negatif olamaz").max(100, "En fazla %100"),
  overweight_tolerance_pct: z.number().min(0, "Negatif olamaz").max(50, "En fazla %50"),
  target_oee_pct: z.number().min(0, "Negatif olamaz").max(100, "En fazla %100"),
  day_shift_start: z.string().regex(HHMM, "Saat SS:DD olmalı"),
  night_shift_start: z.string().regex(HHMM, "Saat SS:DD olmalı"),
}).refine((v) => v.day_shift_start !== v.night_shift_start, {
  message: "Gündüz ve gece vardiyası aynı saatte başlayamaz",
  path: ["night_shift_start"],
});

export type ParametersFormValues = z.infer<typeof parametersSchema>;

export const userRoleSchema = z.enum(["operator", "warehouse", "quality", "admin"]);
