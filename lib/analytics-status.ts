/** Üretim analizi durum sınıfları (sunucu ve tarayıcı bileşenleri ortak kullanır). */
export type Status = "ok" | "warn" | "bad";

export const STATUS_LABELS: Record<Status, string> = { ok: "Hedefte", warn: "Sınırda", bad: "Hedef dışı" };
export const STATUS_COLORS: Record<Status, string> = { ok: "var(--success)", warn: "var(--warning)", bad: "var(--danger)" };
