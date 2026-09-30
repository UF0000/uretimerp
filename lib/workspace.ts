/**
 * Çalışma alanı (sekmeli yapı) — ortak sabitler ve mesaj tipleri.
 * Her sekme uygulama sayfasını bir iframe içinde açık tutar; sekmeler arasında geçişte
 * sayfa durumu (yarım kalmış formlar) korunur. Sekme ↔ çalışma alanı haberleşmesi postMessage ile.
 */

export const WORKSPACE_PATH = "/calisma";
export const APP_TITLE_SUFFIX = " | Üretim ERP";
/** Açık sekmeler (oturum hafızası); girişte temizlenir → ana sayfayla başlanır */
export const TABS_STORAGE_KEY = "uretim-erp:sekmeler";

/** Sayfa (iframe) → çalışma alanı */
export type FrameMessage =
  | { type: "nav"; path: string; title: string } // sayfa adresi / başlığı değişti
  | { type: "open"; path: string }; // bu adresi yeni sekmede aç

/** Çalışma alanı → sayfa (iframe) */
export type HostMessage =
  | { type: "navigate"; path: string } // sekmede bu adrese git
  | { type: "activate" }; // sekmeye geri dönüldü: verileri tazele (form durumu korunur)

/** Adresin bölümü (/uretim/is-emirleri → uretim). Başka bölüme giden bağlantı yeni sekmede açılır. */
export const sectionOf = (path: string) => path.split("?")[0].split("/").filter(Boolean)[0] ?? "";

/** Güvenli iç adres mi (açık yönlendirme / çalışma alanının kendisi değil) */
export const isAppPath = (path: unknown): path is string =>
  typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && sectionOf(path) !== sectionOf(WORKSPACE_PATH) && !path.startsWith("/login");
