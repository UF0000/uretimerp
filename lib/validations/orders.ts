import { z } from "zod";

export const orderItemSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().min(1, "Ürün seçimi zorunludur"),
  quantity: z.number().min(1, "Miktar 1'den büyük olmalıdır"),
});

export const orderSchema = z.object({
  id: z.string().optional(),
  no: z.string().min(1, "Sipariş numarası zorunludur"),
  partner_id: z.string().min(1, "Müşteri/Cari seçimi zorunludur"),
  order_date: z.string().min(1, "Sipariş tarihi zorunludur"),
  delivery_date: z.string().optional().nullable(),
  status: z.enum(["open", "in_production", "done", "cancelled"]).default("open"),
  items: z.array(orderItemSchema).min(1, "Siparişe en az bir ürün eklenmelidir"),
});

export type OrderItemFormValues = z.infer<typeof orderItemSchema>;
export type OrderFormValues = z.infer<typeof orderSchema>;
export type OrderFormInput = z.input<typeof orderSchema>;
