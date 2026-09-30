/**
 * Kalıp bakımı — atış sayısına göre durum (v_mold_maintenance görünümüyle aynı kural).
 * Bakımdan beri atış = toplam atış − son bakımdaki atış; aralığın %80'i "yaklaşıyor", %100'ü "gecikti".
 */

export type MoldMaintenanceState = "tanimsiz" | "uygun" | "yaklasiyor" | "gecikti";

export const WARN_RATIO = 0.8;

export const MAINTENANCE_STATE_LABELS: Record<MoldMaintenanceState, string> = {
  tanimsiz: "Aralık yok",
  uygun: "Uygun",
  yaklasiyor: "Bakım yaklaşıyor",
  gecikti: "Bakım gecikti",
};

export const MAINTENANCE_STATE_BADGE: Record<MoldMaintenanceState, "default" | "secondary" | "outline" | "destructive"> = {
  tanimsiz: "outline",
  uygun: "secondary",
  yaklasiyor: "default",
  gecikti: "destructive",
};

export const MAINTENANCE_KINDS = ["periyodik", "ariza", "revizyon"] as const;
export type MaintenanceKind = (typeof MAINTENANCE_KINDS)[number];
export const MAINTENANCE_KIND_LABELS: Record<MaintenanceKind, string> = {
  periyodik: "Periyodik bakım",
  ariza: "Arıza onarımı",
  revizyon: "Revizyon",
};

export function moldMaintenance(totalShots: number, shotsAtLast: number, intervalShots: number | null) {
  const since = Math.max(0, (totalShots || 0) - (shotsAtLast || 0));
  if (!intervalShots || intervalShots <= 0) return { since, pct: null, remaining: null, state: "tanimsiz" as MoldMaintenanceState };
  const pct = (since / intervalShots) * 100;
  const state: MoldMaintenanceState = since >= intervalShots ? "gecikti" : since >= intervalShots * WARN_RATIO ? "yaklasiyor" : "uygun";
  return { since, pct, remaining: intervalShots - since, state };
}

export const asMaintenanceState = (v: string | null | undefined): MoldMaintenanceState =>
  v === "uygun" || v === "yaklasiyor" || v === "gecikti" ? v : "tanimsiz";
