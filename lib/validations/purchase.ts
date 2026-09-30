import { z } from "@/lib/zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçersiz");

export const purchaseOrderSchema = z.object({
  id: z.string().uuid().optional(),
  partner_id: z.string().uuid("Tedarikçi seçin"),
  order_date: isoDate,
  expected_date: isoDate.optional().nullable(),
  currency: z.enum(["TRY", "USD", "EUR"]),
  note: z.string().trim().max(1000).optional().nullable(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid("Ürün seçin"),
        quantity: z.number().positive("Miktar 0'dan büyük olmalıdır"),
        unit_price: z.number().min(0, "Fiyat 0 veya daha büyük olmalıdır").optional().nullable(),
        note: z.string().trim().max(300).optional().nullable(),
      }),
    )
    .min(1, "En az bir kalem ekleyin"),
});
export type PurchaseOrderValues = z.infer<typeof purchaseOrderSchema>;
export type PurchaseOrderInput = z.input<typeof purchaseOrderSchema>;

export const receiptSchema = z.object({
  purchase_order_id: z.string().uuid(),
  warehouse_id: z.string().uuid("Depo seçin"),
  date: isoDate,
  note: z.string().trim().max(300).optional().nullable(),
  lines: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        qty: z.number().min(0, "Miktar negatif olamaz"),
        lot_no: z.string().trim().max(60).optional().nullable(),
      }),
    )
    .min(1),
});
export type ReceiptValues = z.infer<typeof receiptSchema>;

/** Öneriden taslak sipariş: tedarikçi başına kalemler */
export const draftsFromSuggestionSchema = z
  .array(
    z.object({
      partner_id: z.string().uuid(),
      currency: z.enum(["TRY", "USD", "EUR"]),
      expected_date: isoDate.optional().nullable(),
      items: z.array(z.object({ product_id: z.string().uuid(), quantity: z.number().positive(), unit_price: z.number().min(0).nullable() })).min(1),
    }),
  )
  .min(1, "Tedarikçisi tanımlı kalem yok");
export type DraftsFromSuggestion = z.infer<typeof draftsFromSuggestionSchema>;
