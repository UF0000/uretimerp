import { z } from "zod";

export const productionCompletionSchema = z
  .object({
    work_order_id: z.string().min(1),
    total_used_kg: z.number().min(0.01, "Kullanılan hammadde miktarı 0'dan büyük olmalıdır"),
    scrap_kg: z.number().min(0, "Fire miktarı 0'dan küçük olamaz"),
    produced_qty: z.number().min(0.01, "Üretilen miktar 0'dan büyük olmalıdır"),
    scrap_product_id: z.string().optional().nullable(),
    target_warehouse_id: z.string().min(1, "Mamulün gireceği depo seçilmelidir"),
    shift: z.enum(["day", "night"]).default("day"),
    operator: z.string().optional().nullable(),
  })
  .refine((v) => v.scrap_kg <= v.total_used_kg, {
    path: ["scrap_kg"],
    message: "Fire, kullanılan hammaddeden fazla olamaz",
  })
  .refine((v) => v.scrap_kg === 0 || Boolean(v.scrap_product_id), {
    path: ["scrap_product_id"],
    message: "Fire girildiyse hangi hurda ürününe işleneceği seçilmelidir",
  });

export type ProductionCompletionFormValues = z.infer<typeof productionCompletionSchema>;
export type ProductionCompletionFormInput = z.input<typeof productionCompletionSchema>;
