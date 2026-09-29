import { z } from "@/lib/zod";

/** Tek vardiyalık üretim girişi. Aynı kurallar veritabanında (record_production_entry) da denetlenir. */
export const productionEntrySchema = z
  .object({
    work_order_id: z.string().min(1),
    shift: z.enum(["day", "night"]).default("day"),
    operator: z.string().optional().nullable(),
    produced_qty: z.number().min(0, "Üretilen miktar negatif olamaz"),
    total_used_kg: z.number().min(0, "Kullanılan hammadde negatif olamaz"),
    scrap_kg: z.number().min(0, "Fire negatif olamaz"),
    scrap_product_id: z.string().optional().nullable(),
    scrap_reason_code_id: z.string().optional().nullable(),
    downtime_min: z.number().min(0, "Duruş negatif olamaz").max(1440, "Duruş bir günden uzun olamaz"),
    downtime_reason_code_id: z.string().optional().nullable(),
    actual_cycle_time_sec: z.number().positive("Çevrim süresi 0'dan büyük olmalıdır").optional().nullable(),
    target_warehouse_id: z.string().optional().nullable(),
    close_work_order: z.boolean().default(false),
    /** Hammadde ürün id → tüketilen reçine lotu (isteğe bağlı, izlenebilirlik için) */
    raw_lots: z.record(z.string(), z.string()).optional(),
  })
  .refine((v) => v.produced_qty > 0 || v.scrap_kg > 0 || v.downtime_min > 0, {
    path: ["produced_qty"],
    message: "Üretim, fire veya duruştan en az biri girilmelidir",
  })
  .refine((v) => (v.produced_qty === 0 && v.scrap_kg === 0) || v.total_used_kg > 0, {
    path: ["total_used_kg"],
    message: "Üretim veya fire varsa kullanılan hammadde girilmelidir",
  })
  .refine((v) => v.scrap_kg <= v.total_used_kg, {
    path: ["scrap_kg"],
    message: "Fire, kullanılan hammaddeden fazla olamaz",
  })
  .refine((v) => v.produced_qty === 0 || Boolean(v.target_warehouse_id), {
    path: ["target_warehouse_id"],
    message: "Mamulün gireceği depo seçilmelidir",
  })
  .refine((v) => v.scrap_kg === 0 || Boolean(v.scrap_product_id), {
    path: ["scrap_product_id"],
    message: "Fire hangi hurda ürününe işlenecek?",
  })
  .refine((v) => v.scrap_kg === 0 || Boolean(v.scrap_reason_code_id), {
    path: ["scrap_reason_code_id"],
    message: "Fire neden kodu seçilmelidir",
  })
  .refine((v) => v.downtime_min === 0 || Boolean(v.downtime_reason_code_id), {
    path: ["downtime_reason_code_id"],
    message: "Duruş neden kodu seçilmelidir",
  });

export type ProductionEntryFormValues = z.infer<typeof productionEntrySchema>;
export type ProductionEntryFormInput = z.input<typeof productionEntrySchema>;

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Saat girin (SS:DD)");

/**
 * Üretim girişi v2 (save_production_entry): tarih + saat aralığı, listeden operatör,
 * çoklu fire (neden + kg) ve duruş (neden + dk) satırları. Bitiş saati başlangıçtan
 * küçükse ertesi gün sayılır (gece vardiyası).
 */
export const productionEntryV2Schema = z
  .object({
    work_order_id: z.string().min(1),
    replaces_entry_id: z.string().optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih seçin"),
    start_time: hhmm,
    end_time: hhmm,
    operator_id: z.string().min(1, "Operatör seçin"),
    produced_qty: z.number().min(0, "Üretilen miktar negatif olamaz"),
    total_used_kg: z.number().min(0, "Kullanılan hammadde negatif olamaz"),
    scraps: z.array(z.object({ reason_code_id: z.string().min(1, "Fire nedeni seçin"), kg: z.number().positive("0'dan büyük olmalı") })),
    downtimes: z.array(z.object({ reason_code_id: z.string().min(1, "Duruş nedeni seçin"), minutes: z.number().positive("0'dan büyük olmalı") })),
    scrap_product_id: z.string().optional().nullable(),
    target_warehouse_id: z.string().optional().nullable(),
    close_work_order: z.boolean(),
    raw_lots: z.record(z.string(), z.string()).optional(),
  })
  .refine((v) => v.start_time !== v.end_time, { path: ["end_time"], message: "Bitiş saati başlangıçla aynı olamaz" })
  .refine((v) => v.produced_qty > 0 || v.scraps.length > 0 || v.downtimes.length > 0, {
    path: ["produced_qty"],
    message: "Üretim, fire veya duruştan en az biri girilmelidir",
  })
  .refine((v) => (v.produced_qty === 0 && v.scraps.length === 0) || v.total_used_kg > 0, {
    path: ["total_used_kg"],
    message: "Üretim veya fire varsa kullanılan hammadde girilmelidir",
  })
  .refine((v) => v.scraps.reduce((s, x) => s + x.kg, 0) <= v.total_used_kg, {
    path: ["total_used_kg"],
    message: "Toplam fire, kullanılan hammaddeden fazla olamaz",
  })
  .refine((v) => v.produced_qty === 0 || Boolean(v.target_warehouse_id), {
    path: ["target_warehouse_id"],
    message: "Mamulün gireceği depo seçilmelidir",
  })
  .refine((v) => v.scraps.length === 0 || Boolean(v.scrap_product_id), {
    path: ["scrap_product_id"],
    message: "Fire hangi hurda ürününe işlenecek?",
  });

export type ProductionEntryV2Values = z.infer<typeof productionEntryV2Schema>;

/** Türkiye saatiyle (UTC+3) başlangıç/bitiş; bitiş ≤ başlangıç ise ertesi gün */
export function entryRange(date: string, start: string, end: string) {
  const startAt = new Date(`${date}T${start}:00+03:00`);
  let endAt = new Date(`${date}T${end}:00+03:00`);
  if (endAt <= startAt) endAt = new Date(endAt.getTime() + 86400000);
  return { startAt, endAt, minutes: (endAt.getTime() - startAt.getTime()) / 60000 };
}
