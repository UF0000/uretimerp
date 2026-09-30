/**
 * İşlem geçmişi (activity_log) — tablo, işlem ve alan adlarının Türkçe karşılıkları.
 * Kayıtlar veritabanı tetikleyicisiyle yazılır (migration 20260930190000_audit_log.sql).
 */

export const AUDIT_TABLE_LABELS: Record<string, string> = {
  products: "Ürün",
  product_groups: "Grup kodu",
  product_documents: "Ürün dokümanı",
  product_suppliers: "Ürün tedarikçisi",
  supplier_prices: "Tedarikçi fiyatı",
  boms: "Reçete",
  bom_items: "Reçete kalemi",
  bom_extrusion: "Reçete (ekstrüzyon)",
  bom_injection: "Reçete (enjeksiyon)",
  bom_parameters: "Reçete parametresi",
  work_orders: "İş emri",
  production_entries: "Üretim girişi",
  production_entry_scraps: "Üretim girişi fire",
  production_entry_downtimes: "Üretim girişi duruş",
  stock_movements: "Stok hareketi",
  stock_documents: "Stok fişi",
  lots: "Lot",
  orders: "Sipariş",
  order_items: "Sipariş kalemi",
  partners: "Cari",
  molds: "Kalıp",
  production_lines: "Makine / hat",
  warehouses: "Depo",
  operators: "Operatör",
  reason_codes: "Neden kodu",
  quality_checks: "Kalite kontrol",
  ncr: "Uygunsuzluk (NCR)",
  cost_parameters: "Parametreler",
  line_capacities: "Makine kapasitesi",
  reference_capacities: "Referans kapasite",
  calendar_holidays: "Tatil günü",
  profiles: "Kullanıcı",
  mold_maintenances: "Kalıp bakımı",
  purchase_orders: "Satın alma siparişi",
  purchase_order_items: "Satın alma kalemi",
  shipments: "Sevk irsaliyesi",
  stock_counts: "Stok sayımı",
  stock_count_lines: "Sayım kalemi",
};

export const AUDIT_OPERATIONS = ["insert", "update", "deactivate", "restore", "delete"] as const;
export type AuditOperation = (typeof AUDIT_OPERATIONS)[number];

export const AUDIT_OP_LABELS: Record<AuditOperation, string> = {
  insert: "Eklendi",
  update: "Değiştirildi",
  deactivate: "Silindi (pasif)",
  restore: "Geri alındı",
  delete: "Kalıcı silindi",
};

export const AUDIT_OP_BADGE: Record<AuditOperation, "default" | "secondary" | "outline" | "destructive"> = {
  insert: "default",
  update: "secondary",
  deactivate: "destructive",
  restore: "outline",
  delete: "destructive",
};

export const auditOpLabel = (op: string | null) => (op && op in AUDIT_OP_LABELS ? AUDIT_OP_LABELS[op as AuditOperation] : (op ?? "—"));
export const auditTableLabel = (t: string | null) => (t ? (AUDIT_TABLE_LABELS[t] ?? t) : "—");

/** Sık görülen alanların Türkçe adları; bilinmeyen alan olduğu gibi gösterilir */
const FIELD_LABELS: Record<string, string> = {
  active: "Aktif",
  code: "Kod",
  name: "Ad",
  type: "Tür",
  unit: "Birim",
  category: "Aile",
  group_code: "Grup kodu",
  variant_code: "Genel kod",
  material_group: "Malzeme grubu",
  material_grade: "Malzeme sınıfı",
  diameter_mm: "Çap (mm)",
  sdr: "SDR",
  wall_thickness_mm: "Et kalınlığı (mm)",
  pipe_length_m: "Boru boyu (m)",
  min_stock: "Minimum stok",
  critical_stock: "Kritik stok",
  unit_cost: "Birim fiyat",
  currency: "Para birimi",
  description: "Açıklama",
  barcode: "Barkod",
  image_url: "Görsel",
  status: "Durum",
  planned_qty: "Planlanan miktar",
  produced_qty: "Üretilen miktar",
  total_used_kg: "Kullanılan hammadde (kg)",
  scrap_qty: "Fire",
  downtime_min: "Duruş (dk)",
  quantity: "Miktar",
  qty: "Miktar",
  kg: "Kg",
  minutes: "Dakika",
  role: "Rol",
  email: "E-posta",
  capacity_kg_per_hour: "Kapasite (kg/sa)",
  year: "Yıl",
  approval: "Onay",
  off_hours: "Tatil saati",
  cancelled_at: "İptal zamanı",
  note: "Not",
  version: "Versiyon",
  ratio_pct: "Oran (%)",
  cycle_time_sec: "Çevrim (sn)",
  cavity_count: "Göz sayısı",
  kg_per_meter: "Metre ağırlığı (kg/m)",
  target_m_per_hour: "Hedef hız (m/sa)",
  maintenance_interval_shots: "Bakım aralığı (atış)",
  shots_at_last_maintenance: "Son bakımdaki atış",
  last_maintenance: "Son bakım",
  counted_qty: "Sayılan miktar",
  system_qty: "Sistem miktarı",
  adjusted_qty: "İşlenen fark",
  unit_price: "Birim fiyat",
  expected_date: "Beklenen teslim",
  delivered_qty: "Teslim edilen",
  vehicle_plate: "Araç plakası",
  driver_name: "Şoför",
};

export const auditFieldLabel = (field: string) => FIELD_LABELS[field] ?? field;

/** Değeri okunur yaz: boş → "—", evet/hayır, sayı nokta/virgül kuralıyla */
export const auditValue = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Evet" : "Hayır";
  if (typeof v === "number") return v.toLocaleString("tr-TR", { maximumFractionDigits: 3 });
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};
