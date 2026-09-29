import { z } from "@/lib/zod";

export const productSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, "Ürün kodu zorunludur"),
  name: z.string().min(1, "Ürün adı zorunludur"),
  type: z.enum(["finished", "raw", "semi", "regrind", "scrap"]),
  unit: z.enum(["adet", "kg", "metre"]),
  category: z.string().optional().nullable(),
  material_grade: z.string().optional().nullable(),
  min_stock: z.number().min(0),
  critical_stock: z.number().default(0),
  unit_cost: z.number().optional().default(0),
  currency: z.string().optional().default("TRY"),
});

export type ProductFormValues = z.infer<typeof productSchema>;
export type ProductFormInput = z.input<typeof productSchema>;

export const partnerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Cari adı zorunludur"),
  type: z.enum(["customer", "supplier"]),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export type PartnerFormValues = z.infer<typeof partnerSchema>;

export const warehouseSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Depo adı zorunludur"),
  type: z.enum(["raw", "finished", "quarantine", "scrap", "regrind"]),
});

export type WarehouseFormValues = z.infer<typeof warehouseSchema>;

export const lineSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, "Hat kodu zorunludur"),
  name: z.string().min(1, "Hat adı zorunludur"),
  head_type: z.string().optional().nullable(),
  status: z.enum(["active", "maintenance", "down"]),
  line_type: z.enum(["extrusion", "injection"]).optional().nullable(),
});

export type LineFormValues = z.infer<typeof lineSchema>;

export const moldSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, "Kalıp kodu zorunludur"),
  name: z.string().min(1, "Kalıp adı zorunludur"),
  product_id: z.string().optional().nullable(),
  cavity_count: z.number().min(1),
  cycle_time_sec: z.number().min(0.1),
  total_shots: z.number().min(0).default(0),
  sprue_weight_g: z.number().min(0).optional().nullable(),
  product_weight_g: z.number().min(0).optional().nullable(),
  maintenance_plan: z.string().optional().nullable(),
  status: z.enum(["active", "maintenance", "down"]),
});

export type MoldFormValues = z.infer<typeof moldSchema>;
export type MoldFormInput = z.input<typeof moldSchema>;

export const reasonCodeSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(["scrap", "downtime"]),
  code: z.string().min(1, "Kod zorunludur"),
  label: z.string().min(1, "Açıklama zorunludur"),
});

export type ReasonCodeFormValues = z.infer<typeof reasonCodeSchema>;
