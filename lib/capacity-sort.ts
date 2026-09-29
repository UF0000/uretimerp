/**
 * Referans kapasite sıralaması (Yönetim → Kapasite):
 * önce PE, sonra PP (PP/PPR), sonra diğer gruplar.
 * PE'de küçük çaptan büyüğe; PP'de SDR 6 → 7,4 → 11, her SDR içinde küçük çaptan büyüğe.
 * Aynı satırlarda en yeni yıl önce.
 */
export const materialGroupRank = (group: string) => {
  const g = group.trim().toUpperCase();
  if (g.startsWith("PE")) return 0;
  if (g.startsWith("PP")) return 1;
  return 2;
};

export const compareMaterialGroups = (a: string, b: string) => materialGroupRank(a) - materialGroupRank(b) || a.localeCompare(b, "tr");

type RefCapacity = { material_group: string; diameter_mm: number; sdr: number | null; year: number };

const bySdr = (a: number | null, b: number | null) => (a ?? Infinity) - (b ?? Infinity);

export const compareReferenceCapacities = (a: RefCapacity, b: RefCapacity) => {
  const group = compareMaterialGroups(a.material_group, b.material_group);
  if (group) return group;
  const pp = materialGroupRank(a.material_group) === 1;
  const primary = pp ? bySdr(a.sdr, b.sdr) || a.diameter_mm - b.diameter_mm : a.diameter_mm - b.diameter_mm || bySdr(a.sdr, b.sdr);
  return primary || b.year - a.year;
};
