/**
 * Satın alma önerisi (saf fonksiyon).
 *
 * Kaynaklar: net ihtiyaçta eksik çıkan hammadde / ticari mal + siparişi olmasa da stoğu minimum altına düşenler.
 * Önerilen miktar = net eksik (+ "minimum stoğa tamamla" açıksa minimum stok);
 *                   ihtiyaç yok ama minimum altındaysa = minimum − stok. Tedarikçinin en az sipariş miktarına yuvarlanır.
 * Tedarikçi: ürün kartında ana (is_primary) tedarikçi, yoksa ilk eklenen; fiyat: geçerlilik tarihi bugünü geçmeyen en yeni fiyat.
 */

export interface PurchaseSupplier {
  partnerId: string;
  partnerName: string;
  supplierCode: string | null;
  leadTimeDays: number | null;
  minOrderQty: number | null;
  price: number | null;
  currency: string | null;
}

export interface PurchaseProduct {
  id: string;
  code: string;
  name: string;
  unit: string;
  type: string;
  minStock: number;
}

export interface PurchaseInput {
  /** Net ihtiyaçtaki eksikler (MRP) */
  shortages: { productId: string; net: number; stock: number; earliestDue: string | null }[];
  /** Stoğu minimum altındaki hammadde / ticari mallar (ihtiyaçtan bağımsız) */
  belowMin: { productId: string; stock: number }[];
  products: Map<string, PurchaseProduct>;
  suppliers: Map<string, PurchaseSupplier>;
  topUpToMin: boolean;
}

export interface PurchaseRow {
  product: PurchaseProduct;
  stock: number;
  net: number;
  /** recetesiz: mamul / yarı mamul ama reçetesi yok → satın alma değil, reçete açılmalı */
  reason: "ihtiyac" | "minimum" | "recetesiz";
  suggestedQty: number;
  supplier: PurchaseSupplier | null;
  earliestDue: string | null;
}

const ceil = (v: number, unit: string) => (unit === "kg" ? Math.ceil(v * 100) / 100 : Math.ceil(v));

export function buildPurchaseSuggestions(input: PurchaseInput): PurchaseRow[] {
  const { shortages, belowMin, products, suppliers, topUpToMin } = input;
  const rows = new Map<string, PurchaseRow>();

  for (const s of shortages) {
    const product = products.get(s.productId);
    if (!product || s.net <= 0) continue;
    const qty = s.net + (topUpToMin ? Math.max(0, product.minStock) : 0);
    const reason = product.type === "finished" || product.type === "semi" ? "recetesiz" : "ihtiyac";
    rows.set(s.productId, { product, stock: s.stock, net: s.net, reason, suggestedQty: qty, supplier: suppliers.get(s.productId) ?? null, earliestDue: s.earliestDue });
  }
  for (const b of belowMin) {
    const product = products.get(b.productId);
    if (!product || rows.has(b.productId) || product.minStock <= 0) continue;
    const qty = product.minStock - Math.max(0, b.stock);
    if (qty <= 0) continue;
    rows.set(b.productId, { product, stock: b.stock, net: 0, reason: "minimum", suggestedQty: qty, supplier: suppliers.get(b.productId) ?? null, earliestDue: null });
  }

  for (const r of rows.values()) {
    const moq = r.supplier?.minOrderQty ?? 0;
    r.suggestedQty = ceil(Math.max(r.suggestedQty, moq), r.product.unit);
  }

  // Tedarikçiye göre, sonra koda göre
  return [...rows.values()].sort(
    (a, b) => (a.supplier?.partnerName ?? "~").localeCompare(b.supplier?.partnerName ?? "~", "tr") || a.product.code.localeCompare(b.product.code, "tr", { numeric: true }),
  );
}

// ─── Satın alma siparişi durumları ───

export type PurchaseOrderStatus = "draft" | "ordered" | "closed" | "cancelled";
export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Taslak",
  ordered: "Sipariş verildi",
  closed: "Kapandı",
  cancelled: "İptal",
};
export const PO_STATUS_BADGE: Record<PurchaseOrderStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  ordered: "default",
  closed: "secondary",
  cancelled: "destructive",
};
export const poStatusLabel = (s: string) => PO_STATUS_LABELS[s as PurchaseOrderStatus] ?? s;
export const poStatusBadge = (s: string) => PO_STATUS_BADGE[s as PurchaseOrderStatus] ?? "outline";

export const DELIVERY_LABELS = { none: "Teslim alınmadı", partial: "Kısmi teslim", full: "Tamamı teslim alındı" } as const;
