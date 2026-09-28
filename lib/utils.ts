import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Supabase'in tekil ilişkileri (örn. work_orders → boms) tip olarak dizi
 * görünebilir; çalışma anında nesne gelir. İkisini de tek nesneye indirger.
 */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** catch bloğundaki bilinmeyen hatadan kullanıcıya gösterilecek mesajı çıkarır. */
export function getErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Beklenmeyen bir hata oluştu.";
  // Veritabanı yetki (RLS) hataları kullanıcıya Türkçe ve anlaşılır gösterilir
  if (/row-level security|permission denied/i.test(message)) {
    return "Bu işlem için yetkiniz yok. Gerekirse yöneticinizden rol değişikliği isteyin.";
  }
  return message;
}
