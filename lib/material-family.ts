/**
 * Hammadde ailesi (raporlarda PP / PE / PERT / PEX gruplaması).
 * Ürün kartında kategori doluysa o kullanılır; boşsa stok kodunun ilk bölümünden
 * (PP.000.N.004.27 → PP) bilinen ailelere eşlenir, bilinmeyen önek olduğu gibi kalır.
 */

const FAMILY_BY_PREFIX: Record<string, string> = {
  PP: "PP (Polipropilen)",
  PPRC: "PP (Polipropilen)",
  PPRGF: "PP (Polipropilen)", // cam elyaf takviyeli PP-R
  PE: "PE (Polietilen)",
  PERT: "PERT",
  PEX: "PEX (Çapraz Bağlı PE)",
  PEXB: "PEX (Çapraz Bağlı PE)",
  MAS: "Masterbatch",
  ALU: "Alüminyum",
  CAT: "Katalizör",
  ADH: "Yapıştırıcı",
};

export function materialFamily(product: { code: string; category?: string | null }): string {
  const category = product.category?.trim();
  if (category) return category;
  const prefix = product.code.split(".")[0].toUpperCase();
  return FAMILY_BY_PREFIX[prefix] ?? prefix;
}
