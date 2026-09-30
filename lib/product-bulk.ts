/**
 * Ürün listesinde toplu güncellenebilen özellikler (sunucu + tarayıcı ortak).
 * clearable = "Temizle" ile boşaltılabilir; zorunlu alanlar yalnızca değer atanır.
 */
export const BULK_FIELDS = [
  { field: "category", label: "Aile", kind: "category", clearable: true },
  { field: "type", label: "Ürün türü", kind: "type", clearable: false },
  { field: "group_code", label: "Grup kodu", kind: "group", clearable: true },
  { field: "variant_code", label: "Genel kod (varyant)", kind: "text", clearable: true },
  { field: "material_group", label: "Malzeme grubu (PE, PP/PPR…)", kind: "text", clearable: true },
  { field: "unit", label: "Birim", kind: "unit", clearable: false },
  { field: "diameter_mm", label: "Çap (mm)", kind: "number", clearable: true },
  { field: "sdr", label: "SDR", kind: "number", clearable: true },
  { field: "wall_thickness_mm", label: "Et kalınlığı (mm)", kind: "number", clearable: true },
  { field: "pipe_length_m", label: "Boru boyu (m)", kind: "number", clearable: true },
  { field: "min_stock", label: "Minimum stok", kind: "number", clearable: false },
  { field: "critical_stock", label: "Kritik stok", kind: "number", clearable: false },
] as const;

export type BulkField = (typeof BULK_FIELDS)[number]["field"];
export type BulkFieldDef = (typeof BULK_FIELDS)[number];

export const UNIT_LABELS = { adet: "Adet", kg: "Kg", metre: "Metre" } as const;
