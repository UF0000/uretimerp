/**
 * Stok fişi türleri — Türkçe adlar, renkler ve yazdırılan belge başlıkları (sunucu + tarayıcı ortak).
 */

export const STOCK_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  in_purchase: "Satınalma Girişi",
  in_production: "Üretimden Giriş",
  in_count: "Sayım Fazlası",
  transfer: "Depo Transferi",
  out_sale: "Satış Çıkışı",
  out_consumption: "Sarf / Üretime Çıkış",
  out_scrap: "Fire / Hurda",
  out_count: "Sayım Eksiği",
};

export const STOCK_DOCUMENT_TYPE_COLORS: Record<string, string> = {
  in_purchase: "border-success/30 bg-success/10 text-success",
  in_production: "border-success/30 bg-success/10 text-success",
  in_count: "border-success/30 bg-success/10 text-success",
  transfer: "border-info/30 bg-info/10 text-info",
  out_sale: "border-danger/30 bg-danger/10 text-danger",
  out_consumption: "border-danger/30 bg-danger/10 text-danger",
  out_scrap: "border-danger/30 bg-danger/10 text-danger",
  out_count: "border-danger/30 bg-danger/10 text-danger",
};

export type StockDocumentKind = "giris" | "cikis" | "transfer";

export const stockDocumentKind = (type: string): StockDocumentKind => (type === "transfer" ? "transfer" : type.startsWith("in_") ? "giris" : "cikis");

/** Yazdırılan belgenin başlığı ve imza alanları */
export const STOCK_DOCUMENT_PRINT: Record<StockDocumentKind, { title: string; signatures: string[] }> = {
  giris: { title: "DEPO GİRİŞ FİŞİ", signatures: ["Teslim eden", "Teslim alan (Depo)", "Onaylayan"] },
  cikis: { title: "DEPO ÇIKIŞ FİŞİ", signatures: ["Teslim eden (Depo)", "Teslim alan", "Onaylayan"] },
  transfer: { title: "DEPO TRANSFER FİŞİ", signatures: ["Gönderen depo", "Alan depo", "Onaylayan"] },
};
