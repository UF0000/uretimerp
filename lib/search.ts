/**
 * Ortak arama kuralı: yazılan metin kelimelere bölünür, her kelime kaydın
 * alanlarından birinde geçmelidir (sıra önemsiz). Büyük/küçük harf, Türkçe
 * karakter (ç/c, ş/s, ı/i…) ve ondalık ayırıcı (7,4 / 7.4) farkı gözetilmez.
 * Örn. "henq sdr 6" → adında/kodunda HENQ, SDR ve 6 geçen ürünler.
 */
export const normalizeSearch = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/,/g, ".");

export const searchTokens = (query: string) => normalizeSearch(query).split(/\s+/).filter(Boolean);

export const matchesTokens = (tokens: string[], ...fields: (string | number | null | undefined)[]) => {
  if (!tokens.length) return true;
  const haystack = normalizeSearch(fields.filter((f) => f !== null && f !== undefined && f !== "").join(" "));
  return tokens.every((t) => haystack.includes(t));
};

/** Bir kaydın (iç içe nesneler dahil) tüm metin/sayı değerleri — tablo içi genel arama için */
export function recordText(value: unknown, depth = 0): string {
  if (value === null || value === undefined || depth > 3) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((v) => recordText(v, depth + 1)).join(" ");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map((v) => recordText(v, depth + 1)).join(" ");
  return "";
}
