import { z } from "@/lib/zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin");

/** Makine kapasitesi: geçerlilik tarihli (bitiş boşsa hâlâ geçerli). */
export const lineCapacitySchema = z
  .object({
    line_id: z.string().uuid("Makine seçin"),
    capacity_kg_per_hour: z.number().positive("Kapasite 0'dan büyük olmalıdır"),
    valid_from: isoDate,
    valid_to: isoDate.nullable(),
    note: z.string().max(200).nullable(),
  })
  .refine((v) => !v.valid_to || v.valid_to >= v.valid_from, {
    message: "Bitiş tarihi başlangıçtan önce olamaz",
    path: ["valid_to"],
  });

export type LineCapacityFormValues = z.infer<typeof lineCapacitySchema>;

/** Referans kapasite: malzeme grubu × çap × SDR için yıllık kg/saat. */
export const referenceCapacitySchema = z.object({
  id: z.string().uuid().optional(),
  material_group: z.string().trim().min(1, "Malzeme grubu zorunludur"),
  diameter_mm: z.number().positive("Çap 0'dan büyük olmalıdır"),
  sdr: z.number().positive("SDR 0'dan büyük olmalıdır").nullable(),
  capacity_kg_per_hour: z.number().positive("Kapasite 0'dan büyük olmalıdır"),
  year: z.number().int("Tam sayı girin").min(2000, "Geçerli bir yıl girin").max(2100, "Geçerli bir yıl girin"),
  source: z.string().max(200).nullable(),
  approval: z.enum(["approved", "pending"]),
});

export type ReferenceCapacityFormValues = z.infer<typeof referenceCapacitySchema>;

/** Tatil / kapalı gün: o gün düşülecek saat (24 = tam gün). */
export const holidaySchema = z.object({
  day: isoDate,
  name: z.string().trim().min(1, "Açıklama zorunludur"),
  off_hours: z.number().positive("0'dan büyük olmalıdır").max(24, "En fazla 24 saat"),
});

export type HolidayFormValues = z.infer<typeof holidaySchema>;

/** Haftalık kapalı günler: 0 = Pazar … 6 = Cumartesi */
export const weeklyOffDaysSchema = z.array(z.number().int().min(0).max(6)).max(7);
