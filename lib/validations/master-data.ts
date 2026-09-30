import { z } from "@/lib/zod";
import { CATEGORY_LABELS, PRODUCT_TYPES } from "@/lib/product-meta";
import { MAINTENANCE_KINDS } from "@/lib/mold-maintenance";

export const productSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, "Ürün kodu zorunludur"),
  name: z.string().min(1, "Ürün adı zorunludur"),
  type: z.enum(PRODUCT_TYPES),
  unit: z.enum(["adet", "kg", "metre"]),
  category: z.string().optional().nullable(),
  material_grade: z.string().optional().nullable(),
  /** Boru boyutu: referans kapasite eşleşmesi (grup × çap × SDR) için */
  material_group: z.string().trim().optional().nullable(),
  diameter_mm: z.number().positive("Çap 0'dan büyük olmalıdır").optional().nullable(),
  sdr: z.number().positive("SDR 0'dan büyük olmalıdır").optional().nullable(),
  wall_thickness_mm: z.number().positive("Et kalınlığı 0'dan büyük olmalıdır").optional().nullable(),
  /** Ürün türü grubu (ör. 03); stok kodundan bağımsız */
  group_code: z.string().trim().max(20).optional().nullable(),
  /** Genel stok kodu: aynı kodu taşıyan ürünler birbirinin varyantıdır */
  variant_code: z.string().trim().max(60).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  // Paketleme: iç poşet → dış paket (kutu) → palet
  bag_type: z.string().trim().max(40).optional().nullable(),
  bag_qty: z.number().positive("0'dan büyük olmalıdır").optional().nullable(),
  package_type: z.string().trim().max(40).optional().nullable(),
  package_qty: z.number().positive("0'dan büyük olmalıdır").optional().nullable(),
  pallet_qty: z.number().positive("0'dan büyük olmalıdır").optional().nullable(),
  pipe_length_m: z.number().positive("0'dan büyük olmalıdır").optional().nullable(),
  package_weight_kg: z.number().positive("0'dan büyük olmalıdır").optional().nullable(),
  barcode: z.string().trim().max(40).optional().nullable(),
  package_note: z.string().trim().max(300).optional().nullable(),
  min_stock: z.number().min(0),
  critical_stock: z.number().default(0),
  unit_cost: z.number().optional().default(0),
  currency: z.string().optional().default("TRY"),
});

export type ProductFormValues = z.infer<typeof productSchema>;
export type ProductFormInput = z.input<typeof productSchema>;

/** Toplu özellik güncelleme: tek alan, value = null → temizle (yalnızca boş bırakılabilen alanlarda) */
const categoryKeys = Object.keys(CATEGORY_LABELS) as [string, ...string[]];
const code = (max: number) => z.string().trim().min(1, "Değer girin").max(max).transform((v) => v.toUpperCase());
const size = z.number().positive("0'dan büyük olmalıdır");
export const bulkProductUpdateSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("category"), value: z.enum(categoryKeys).nullable() }),
  z.object({ field: z.literal("type"), value: z.enum(PRODUCT_TYPES) }),
  z.object({ field: z.literal("unit"), value: z.enum(["adet", "kg", "metre"]) }),
  z.object({ field: z.literal("group_code"), value: code(20).nullable() }),
  z.object({ field: z.literal("variant_code"), value: code(60).nullable() }),
  z.object({ field: z.literal("material_group"), value: code(40).nullable() }),
  z.object({ field: z.literal("diameter_mm"), value: size.nullable() }),
  z.object({ field: z.literal("sdr"), value: size.nullable() }),
  z.object({ field: z.literal("wall_thickness_mm"), value: size.nullable() }),
  z.object({ field: z.literal("pipe_length_m"), value: size.nullable() }),
  z.object({ field: z.literal("min_stock"), value: z.number().min(0, "0 veya daha büyük olmalıdır") }),
  z.object({ field: z.literal("critical_stock"), value: z.number().min(0, "0 veya daha büyük olmalıdır") }),
]);
export type BulkProductUpdate = z.input<typeof bulkProductUpdateSchema>;

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
  /** Kaç atışta bir periyodik bakım (boş = takip yok) */
  maintenance_interval_shots: z.number().int("Tam sayı girin").positive("0'dan büyük olmalıdır").optional().nullable(),
  status: z.enum(["active", "maintenance", "down"]),
  /** Kalıp çalışma tipi: otomatik / yarı otomatik (analiz panosu) */
  operation_mode: z.enum(["otomatik", "yari_otomatik"]).optional().nullable(),
});

export type MoldFormValues = z.infer<typeof moldSchema>;

export const moldMaintenanceSchema = z.object({
  mold_id: z.string().uuid(),
  done_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçersiz"),
  kind: z.enum(MAINTENANCE_KINDS),
  description: z.string().trim().max(1000).optional().nullable(),
  performed_by: z.string().trim().max(120).optional().nullable(),
  downtime_hours: z.number().min(0, "0 veya daha büyük olmalıdır").optional().nullable(),
  cost: z.number().min(0, "0 veya daha büyük olmalıdır").optional().nullable(),
});
export type MoldMaintenanceValues = z.infer<typeof moldMaintenanceSchema>;
export type MoldFormInput = z.input<typeof moldSchema>;

export const reasonCodeSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(["scrap", "downtime"]),
  code: z.string().min(1, "Kod zorunludur"),
  label: z.string().min(1, "Açıklama zorunludur"),
});

export type ReasonCodeFormValues = z.infer<typeof reasonCodeSchema>;
