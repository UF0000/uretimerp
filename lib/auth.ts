/**
 * Rol kontrolü yardımcıları.
 * Supabase profiles tablosundaki role alanına göre yetki kontrolü yapar.
 */

import { createClient } from "@/lib/supabase/server";

// ─── Tipler ────────────────────────────────────────

export type UserRole = "operator" | "warehouse" | "quality" | "admin";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

// ─── Rol matrisi ───────────────────────────────────

const ROLE_PERMISSIONS: Record<string, UserRole[]> = {
  // Üretim girişi
  "production:write": ["operator", "admin"],

  // Stok hareketi
  "stock:write": ["warehouse", "admin"],

  // Kalite / NCR
  "quality:write": ["quality", "admin"],

  // Ana veri / Reçete — herkes okuyabilir, sadece admin yazabilir
  "master-data:read": ["operator", "warehouse", "quality", "admin"],
  "master-data:write": ["admin"],

  // Sipariş
  "order:read": ["operator", "warehouse", "admin"],
  "order:write": ["admin"],

  // Yönetim / silme
  "admin:all": ["admin"],
};

// ─── Fonksiyonlar ──────────────────────────────────

/**
 * Giriş yapmış kullanıcının profil bilgilerini getirir.
 * @returns Kullanıcı profili veya null
 */
export const getCurrentUser = async (): Promise<UserProfile | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) return null;

  return profile as UserProfile;
};

/**
 * Kullanıcının belirli bir yetkiye sahip olup olmadığını kontrol eder.
 * @param permission - Kontrol edilecek yetki (örn. "production:write")
 * @param userRole - Kullanıcının rolü
 * @returns Yetkili ise true
 */
export const hasPermission = (
  permission: string,
  userRole: UserRole
): boolean => {
  const allowedRoles = ROLE_PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(userRole);
};

/**
 * Kullanıcının admin olup olmadığını kontrol eder.
 */
export const isAdmin = (role: UserRole): boolean => role === "admin";
