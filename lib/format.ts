/**
 * Türkçe sayı formatlama yardımcıları.
 * Kural: nokta = binlik ayırıcı, virgül = ondalık ayırıcı
 * Örnek: 12500.75 → "12.500,75"
 */

/**
 * Sayıyı Türkçe formata çevirir.
 * @param value - Formatlanacak sayı
 * @param decimals - Ondalık basamak sayısı (varsayılan: 2)
 * @returns Formatlanmış string — örn. "12.500,75"
 */
export const formatTR = (value: number, decimals: number = 2): string => {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Türkçe formattaki string'i sayıya çevirir.
 * @param value - Parse edilecek string — örn. "12.500,75"
 * @returns Sayısal değer — örn. 12500.75
 */
export const parseTR = (value: string): number => {
  if (!value || value.trim() === "") return 0;

  // Binlik ayırıcı noktaları kaldır, ondalık virgülü noktaya çevir
  const normalized = value
    .replace(/\./g, "")   // binlik noktaları kaldır
    .replace(",", ".");   // ondalık virgülü noktaya çevir

  const result = parseFloat(normalized);
  return isNaN(result) ? 0 : result;
};

/**
 * Para birimi formatı (₺).
 * @param value - Formatlanacak sayı
 * @returns Formatlanmış string — örn. "₺12.500,75"
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Tarih formatı (Türkçe).
 * @param date - Date nesnesi veya ISO string
 * @returns Formatlanmış string — örn. "03.07.2026"
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
};

/**
 * Tarih + saat formatı (Türkçe).
 * @param date - Date nesnesi veya ISO string
 * @returns Formatlanmış string — örn. "03.07.2026 15:30"
 */
export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};
