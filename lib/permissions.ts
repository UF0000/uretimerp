/**
 * Rol → yetki matrisi. Sunucu ve tarayıcı tarafında ortak kullanılır (saf modül).
 * Veritabanı RLS politikalarıyla (supabase/migrations/*_rls_hardening.sql) aynı olmalıdır;
 * arayüzdeki gizleme sadece kolaylık içindir, asıl koruma RLS'tedir.
 */

export type UserRole = "operator" | "warehouse" | "quality" | "admin";

export const ROLE_LABELS: Record<UserRole, string> = {
  operator: "Operatör",
  warehouse: "Depocu",
  quality: "Kalite",
  admin: "Yönetici",
};

const ROLE_PERMISSIONS = {
  // İş emri + üretim girişi
  "production:write": ["operator", "admin"],
  // Manuel stok hareketi, stok fişi, iptal (ters kayıt)
  "stock:write": ["warehouse", "admin"],
  // Kalite kontrol / NCR
  "quality:write": ["quality", "admin"],
  // Ana veri + reçete: herkes okur, sadece admin yazar
  "master-data:read": ["operator", "warehouse", "quality", "admin"],
  "master-data:write": ["admin"],
  // Sipariş
  "order:read": ["operator", "warehouse", "admin"],
  "order:write": ["admin"],
  // Yönetim
  "admin:all": ["admin"],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof ROLE_PERMISSIONS;

/**
 * Rolün belirli bir yetkiye sahip olup olmadığını döndürür.
 * @param permission - Örn. "production:write"
 * @param role - Kullanıcının rolü
 */
export const hasPermission = (permission: Permission, role: UserRole): boolean =>
  (ROLE_PERMISSIONS[permission] as readonly UserRole[]).includes(role);
