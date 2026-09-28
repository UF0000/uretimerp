import { z } from "zod";

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
