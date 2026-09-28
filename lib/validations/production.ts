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
