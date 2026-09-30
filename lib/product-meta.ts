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
  baglanti_parcasi: "Fitting",
  metal: "Metal",
  hammadde: "Hammadde",
  ambalaj: "Ambalaj / Paketleme",
  sarf_malzeme: "Sarf Malzeme",
  yedek_parca: "Yedek Parça",
  diger: "Diğer",
};

export const categoryLabel = (c: string | null | undefined) => (c ? (CATEGORY_LABELS[c] ?? c) : "—");

/**
 * Koddan grup kodu (KIRILIM listesi):
 * - PE / sifonik: son iki hane (D.110.090.03 → 03, D.040.ENJ.21 → 21)
 * - Hammadde: ".27" ile biten kodlar (PE.100.N.000.27, MAS.PE.GN.000.27) → 27
 * - PP boru: renk harfi + 1A… (V1A0420L4.HENQ) → 24
 * - PP fitting: renk harfi + 1C… / 1B… (V1C012020) → 25
 * Migration 20260930100000 aynı kuralı SQL'de uygular.
 */
export function groupCodeFromCode(code: string): string | null {
  const c = code.trim().toUpperCase();
  const pe = /^D\.[0-9A-Z.]+\.([0-9]{2})$/.exec(c);
  if (pe) return pe[1];
  if (/\.27$/.test(c)) return "27";
  if (/^[A-Z]1A[0-9]/.test(c)) return "24";
  if (/^[A-Z]1[BC][0-9]/.test(c)) return "25";
  return null;
}

/**
 * Koddan ürün rengi: PP'de ilk harf (V yeşil, A mavi, G gri, W beyaz, L lila),
 * sifonik (D.) ürünler siyah. Bilinmeyen harf olduğu gibi döner.
 */
const COLOR_BY_LETTER: Record<string, string> = { V: "Yeşil", A: "Mavi", G: "Gri", W: "Beyaz", L: "Lila" };
export function colorFromCode(code: string): string | null {
  const c = code.trim().toUpperCase();
  if (c.startsWith("D.")) return "Siyah";
  const m = /^([A-Z])1[A-Z][0-9]/.exec(c);
  return m ? (COLOR_BY_LETTER[m[1]] ?? m[1]) : null;
}

export type MoldMode = "otomatik" | "yari_otomatik";
export const MOLD_MODE_LABELS: Record<MoldMode, string> = { otomatik: "Otomatik", yari_otomatik: "Yarı otomatik" };
/** Veritabanındaki metni kalıp çalışma tipine çevirir (bilinmeyen → null) */
export const asMoldMode = (v: string | null | undefined): MoldMode | null => (v === "otomatik" || v === "yari_otomatik" ? v : null);

/** Ürün sıralaması: grup kodu 01 → 27 (grupsuzlar sonda), grup içinde stok kodu. */
export const compareByGroup = (a: { group_code: string | null; code: string }, b: { group_code: string | null; code: string }) => {
  if (a.group_code !== b.group_code) {
    if (!a.group_code) return 1;
    if (!b.group_code) return -1;
    return a.group_code.localeCompare(b.group_code, "tr", { numeric: true });
  }
  return a.code.localeCompare(b.code, "tr", { numeric: true });
};

/**
 * PP varyant kuralı: ilk harf renk, ilk "." sonrası firma/ek; son rakamdan sonra ek kalmaz.
 * V1A012020.HENQ → 1A012020, V1A0320L4.UR.R → 1A0320L4. PE ve kurala uymayan kodlarda null.
 * Migration 20260930160000 (pp_variant_base) aynı kuralı SQL'de uygular.
 */
export function variantBaseFromCode(code: string): string | null {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]1[ABC][0-9]/.test(c)) return null;
  return c.split(".")[0].replace(/[^0-9]+$/, "").slice(1);
}
