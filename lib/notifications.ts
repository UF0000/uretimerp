/**
 * Bildirimler (üst çubuktaki zil) — tipler ve gruplar. Hesap: app/actions/notifications.ts
 */

export type NotificationKind = "stok" | "kalip" | "ncr" | "siparis";

export interface AppNotification {
  /** Durum değişince (ör. yaklaşıyor → gecikti) yeni anahtar → tekrar "yeni" sayılır */
  key: string;
  kind: NotificationKind;
  severity: "danger" | "warning";
  title: string;
  detail: string;
  /** Tıklanınca yeni sekmede açılacak sayfa */
  href: string;
}

export const NOTIFICATION_GROUPS: { kind: NotificationKind; label: string }[] = [
  { kind: "siparis", label: "Teslim tarihi geçen siparişler" },
  { kind: "stok", label: "Stok uyarıları" },
  { kind: "kalip", label: "Kalıp bakımı" },
  { kind: "ncr", label: "Açık uygunsuzluklar (NCR)" },
];

/** Görülen bildirim anahtarları (tarayıcıda) */
export const SEEN_NOTIFICATIONS_KEY = "uretim-erp:bildirim-goruldu";
