import { z } from "@/lib/zod";

export const stockMovementSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().min(1, "Ürün seçimi zorunludur"),
  warehouse_id: z.string().min(1, "Depo seçimi zorunludur"),
  direction: z.enum(["in", "out"], {
    error: "Hareket yönü (Giriş/Çıkış) seçilmelidir",
  }),
  quantity: z.number().min(0.001, "Miktar 0'dan büyük olmalıdır"),
  lot_no: z.string().optional().nullable(),
  source_type: z.enum(["production", "sale", "purchase", "count", "transfer", "scrap"]),
  source_id: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  document_id: z.string().optional().nullable(),
});

export type StockMovementFormValues = z.infer<typeof stockMovementSchema>;

export const stockDocumentItemSchema = z.object({
  product_id: z.string().min(1, "Ürün zorunludur"),
  quantity: z.number().min(0.001, "Miktar 0'dan büyük olmalıdır"),
  lot_no: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const stockDocumentSchema = z.object({
  id: z.string().optional(),
  no: z.string().optional(),
  type: z.enum([
    "in_purchase",
    "in_production",
    "in_count",
    "transfer",
    "out_sale",
    "out_consumption",
    "out_scrap",
    "out_count",
  ], {
    error: "Fiş tipi seçilmelidir",
  }),
  document_date: z.string().min(1, "Tarih zorunludur"),
  source_warehouse_id: z.string().optional().nullable(),
  target_warehouse_id: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  items: z.array(stockDocumentItemSchema).min(1, "En az bir kalem eklenmelidir"),
});

export type StockDocumentFormValues = z.infer<typeof stockDocumentSchema>;
export type StockDocumentItemValues = z.infer<typeof stockDocumentItemSchema>;
