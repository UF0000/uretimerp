import { z } from "@/lib/zod";

export const qualityCheckSchema = z.object({
  type: z.enum(["incoming", "process", "final"]),
  product_id: z.string().min(1, "Ürün seçimi zorunludur"),
  work_order_id: z.string().optional().nullable(),
  lot_no: z.string().optional().nullable(),
  standard: z.string().optional(),
  result: z.enum(["accept", "reject", "conditional"]),
  // Ölçüm adı → değer (örn. { "et_kalinligi_mm": 2.3 })
  measurements: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
});

export type QualityCheckFormValues = z.infer<typeof qualityCheckSchema>;

/** NCR açma. Karantina seçilirse kaynak depo zorunludur (veritabanında da denetlenir). */
export const ncrCreateSchema = z
  .object({
    product_id: z.string().min(1, "Ürün seçimi zorunludur"),
    lot_no: z.string().optional().nullable(),
    description: z.string().trim().min(3, "Uygunsuzluğu kısaca açıklayın"),
    quantity: z.number().positive("Miktar 0'dan büyük olmalıdır"),
    quality_check_id: z.string().optional().nullable(),
    quarantine: z.boolean().default(false),
    source_warehouse_id: z.string().optional().nullable(),
    quarantine_warehouse_id: z.string().optional().nullable(),
  })
  .refine((v) => !v.quarantine || Boolean(v.source_warehouse_id), {
    path: ["source_warehouse_id"],
    message: "Malın bulunduğu depo seçilmelidir",
  })
  .refine((v) => !v.quarantine || Boolean(v.quarantine_warehouse_id), {
    path: ["quarantine_warehouse_id"],
    message: "Karantina deposu seçilmelidir",
  });

export type NcrCreateFormValues = z.infer<typeof ncrCreateSchema>;
export type NcrCreateFormInput = z.input<typeof ncrCreateSchema>;

/** NCR kapatma: kök neden + düzeltici faaliyet zorunlu; karantinada mal varsa karar da. */
export const ncrCloseSchema = z.object({
  id: z.string().min(1),
  root_cause: z.string().trim().min(3, "Kök neden zorunludur"),
  corrective_action: z.string().trim().min(3, "Düzeltici faaliyet zorunludur"),
  disposition: z.enum(["release", "scrap"]).optional().nullable(),
  release_warehouse_id: z.string().optional().nullable(),
});

export type NcrCloseFormValues = z.infer<typeof ncrCloseSchema>;
