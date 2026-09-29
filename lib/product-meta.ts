/**
 * Ürün kartı sabitleri ve kod kuralları (sunucu + tarayıcı ortak).
 */

export const PRODUCT_TYPES = ["finished", "semi", "raw", "trade", "service", "regrind", "scrap"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  finished: "Mamul",
  semi: "Yarı Mamul",
  raw: "Hammadde",
  trade: "Ticari Mal",
  service: "Hizmet",
  regrind: "Regrind (Kırma)",
  scrap: "Hurda",
};

export const PRODUCT_TYPE_BADGE: Record<ProductType, "default" | "secondary" | "outline" | "destructive"> = {
  finished: "default",
  semi: "secondary",
  raw: "secondary",
  trade: "outline",
  service: "outline",
  regrind: "outline",
  scrap: "destructive",
};

/** Ürün ailesi: kartta gösterilecek teknik alanları belirler (boru → hız, fitting → çevrim/yolluk). */
export const CATEGORY_LABELS: Record<string, string> = {
  boru: "Boru",
  baglanti_parcasi: "Fitting (bağlantı parçası)",
  metal: "Metal",
  hammadde: "Hammadde",
  ambalaj: "Ambalaj / Paketleme",
  sarf_malzeme: "Sarf Malzeme",
  yedek_parca: "Yedek Parça",
  diger: "Diğer",
};

export const categoryLabel = (c: string | null | undefined) => (c ? (CATEGORY_LABELS[c] ?? c) : "—");

/** PE kodu: D.110.090.03 → grup kodu "03" (son iki hane). */
export function groupCodeFromCode(code: string): string | null {
  const m = /^D\.[0-9]+(?:\.[0-9]+)*\.([0-9]{2})$/.exec(code.trim());
  return m ? m[1] : null;
}

/**
 * PP varyant kuralı: ilk harf renk, "." sonrası firma eki.
 * V1A012020.HENQ → 1A012020. PE ve kurala uymayan kodlarda null.
 */
export function variantBaseFromCode(code: string): string | null {
  const head = code.trim().split(".")[0];
  if (!/^[A-Za-z][0-9][A-Za-z0-9]+$/.test(head)) return null;
  return head.slice(1).toUpperCase();
}
