/**
 * Sunucu tarafı oturum ve rol yardımcıları.
 * Rol → yetki matrisi lib/permissions.ts içindedir (tarayıcıda da kullanılır).
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, type Permission, type UserRole } from "@/lib/permissions";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

/**
 * Giriş yapmış kullanıcının profil bilgilerini getirir.
 * Aynı istek içinde (yerleşim + sayfa + yetki denetimi) bir kez sorgulanır.
 * @returns Aktif kullanıcı profili veya null
 */
export const getCurrentUser = cache(async (): Promise<UserProfile | null> => {
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

  return profile;
});

/**
 * Sayfa koruması: kullanıcı yetkili değilse "yetkisiz" sayfasına yönlendirir.
 * Server Component'lerin başında çağrılır.
 */
export const requirePermission = async (permission: Permission): Promise<UserProfile> => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(permission, user.role)) redirect("/yetkisiz");
  return user;
};
