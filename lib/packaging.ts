/**
 * Standart kutu tipleri ("1-PP AMBALAJ ETİKET MASTER.xlsx" → SİFONİK GİRDİ).
 * perPallet: bir palete sığan kutu sayısı; palet içi adet = kutu içi × perPallet.
 */
export const BOX_TYPES = [
  { size: "303x303x193", name: "Süzgeç kutusu", perPallet: 88, layout: "8×11 sıra" },
  { size: "400x400x320", name: "Küçük kutu", perPallet: 42, layout: "6×7 sıra" },
  { size: "793x393x313", name: "Orta kutu", perPallet: 21, layout: "3×7 sıra" },
  { size: "793x393x553", name: "Büyük kutu", perPallet: 12, layout: "3×4 sıra" },
] as const;

export const findBoxType = (packageType: string | null | undefined) => {
  const key = packageType?.trim().toLowerCase();
  return key ? BOX_TYPES.find((b) => b.size === key) ?? null : null;
};

/** Paket içi miktardan boru adedi (boy uzunluğu biliniyorsa) */
export const pipesPerPackage = (packageQty: number | null, lengthM: number | null) =>
  packageQty && lengthM ? packageQty / lengthM : null;
