import { z } from "zod";

export const workOrderSchema = z.object({
  id: z.string().optional(),
  no: z.string().min(1, "İş emri numarası zorunludur"),
  product_id: z.string().min(1, "Üretilecek ürün seçimi zorunludur"),
  bom_id: z.string().min(1, "Kullanılacak reçete (BOM) seçimi zorunludur"),
  planned_qty: z.number().min(1, "Planlanan miktar 1'den büyük olmalıdır"),
  line_id: z.string().optional().nullable(),
  mold_id: z.string().optional().nullable(),
  status: z.enum(["planned", "in_progress", "done"]).default("planned"),
  order_id: z.string().optional().nullable(),
});

export type WorkOrderFormValues = z.infer<typeof workOrderSchema>;
export type WorkOrderFormInput = z.input<typeof workOrderSchema>;
