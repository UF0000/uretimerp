"use client";

import { createContext, useContext } from "react";
import { hasPermission, type Permission, type UserRole } from "@/lib/permissions";

const RoleContext = createContext<UserRole | null>(null);

/** Giriş yapmış kullanıcının rolünü alt bileşenlere sağlar (app layout'ta kurulur). */
export const RoleProvider = ({ role, children }: { role: UserRole; children: React.ReactNode }) => (
  <RoleContext.Provider value={role}>{children}</RoleContext.Provider>
);

/**
 * Kullanıcının yetkisi var mı? Butonları gizlemek için kullanılır;
 * asıl koruma veritabanı RLS'inde ve server action'lardadır.
 */
export const usePermission = (permission: Permission): boolean => {
  const role = useContext(RoleContext);
  return role !== null && hasPermission(permission, role);
};

/** Listelerde (menü vb.) birden çok yetkiyi kontrol etmek için: const can = useCan(); can("admin:all") */
export const useCan = (): ((permission: Permission) => boolean) => {
  const role = useContext(RoleContext);
  return (permission) => role !== null && hasPermission(permission, role);
};
