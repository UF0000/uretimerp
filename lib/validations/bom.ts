import { z } from "@/lib/zod";

export const bomItemSchema = z.object({
  id: z.string().optional(),
  component_product_id: z.string().min(1, "Hammadde seçimi zorunludur"),
  quantity: z.number().min(0),
  unit: z.enum(["adet", "kg", "metre"]),
  ratio_pct: z.number().min(0).max(100).optional().nullable(),
});

export const bomExtrusionSchema = z.object({
  line_id: z.string().optional().nullable(),
  kg_per_meter: z.number().min(0).optional().nullable(),
  scrap_pct: z.number().min(0).max(100).optional().nullable(),
  scrap_product_id: z.string().optional().nullable(),
  // OEE performansı için ideal üretim hızı
  target_m_per_hour: z.number().positive("Hedef hız 0'dan büyük olmalıdır").optional().nullable(),
});

export const bomInjectionSchema = z.object({
  mold_id: z.string().optional().nullable(),
  cavity_count: z.number().min(1).optional().nullable(),
  cycle_time_sec: z.number().min(0.1).optional().nullable(),
  runner_sprue_weight_g: z.number().min(0).optional().nullable(),
  product_weight_g: z.number().min(0).optional().nullable(),
  scrap_product_id: z.string().optional().nullable(),
});

export const bomParameterSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1, "Parametre adı zorunludur"),
  value: z.string().min(1, "Parametre değeri zorunludur"),
});

export const bomSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().min(1, "Üretilecek ürün seçimi zorunludur"),
  /** Boş bırakılırsa RCT-#### otomatik verilir; mevcut reçetede değiştirilemez */
  code: z.string().trim().max(30, "En fazla 30 karakter").optional().nullable(),
  name: z.string().trim().min(3, "Reçete adı zorunludur (en az 3 karakter)").max(120, "En fazla 120 karakter"),
  version: z.number().min(1).default(1),
  active: z.boolean().default(true),
  production_type: z.enum(["extrusion", "injection"]),
  regrind_pct: z.number().min(0).max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
  
  // Relations
  items: z.array(bomItemSchema).min(1, "En az bir hammadde eklenmelidir"),
  parameters: z.array(bomParameterSchema).optional(),
  
  // Type specific
  extrusion: bomExtrusionSchema.optional().nullable(),
  injection: bomInjectionSchema.optional().nullable(),
});

export type BomItemFormValues = z.infer<typeof bomItemSchema>;
export type BomParameterFormValues = z.infer<typeof bomParameterSchema>;
export type BomFormValues = z.infer<typeof bomSchema>;
export type BomFormInput = z.input<typeof bomSchema>;
