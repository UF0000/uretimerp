/**
 * Stok yönetimi yardımcıları.
 * TEMEL İLKE: Stok asla doğrudan yazılmaz, yalnızca hareket kaydıyla değişir.
 * `stock_movements` tablosu append-only defterdir.
 * Stok miktarı = hareketlerin toplamı (v_stock view'ı).
 */

import { createClient } from "@/lib/supabase/server";

// ─── Tipler ────────────────────────────────────────

export type StockDirection = "in" | "out";

export type StockSourceType =
  | "production"
  | "sale"
  | "purchase"
  | "count"
  | "transfer"
  | "scrap";

export interface StockMovement {
  product_id: string;
  warehouse_id: string;
  direction: StockDirection;
  quantity: number;
  lot_no?: string;
  source_type: StockSourceType;
  source_id?: string;
  note?: string;
}

export interface StockSummary {
  product_id: string;
  warehouse_id: string;
  qty: number;
}

// ─── Fonksiyonlar ──────────────────────────────────

/**
 * Bir ürünün stok bilgisini getirir (v_stock view'ından).
 * @param productId - Ürün ID
 * @param warehouseId - Opsiyonel depo ID (belirtilmezse tüm depolar)
 * @returns Stok özet listesi
 */
export const getStock = async (
  productId: string,
  warehouseId?: string
): Promise<StockSummary[]> => {
  const supabase = await createClient();

  let query = supabase
    .from("v_stock")
    .select("product_id, warehouse_id, qty")
    .eq("product_id", productId);

  if (warehouseId) {
    query = query.eq("warehouse_id", warehouseId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Stok sorgusu başarısız: ${error.message}`);
  }

  return (data ?? []) as StockSummary[];
};

/**
 * Stok hareketi ekler (APPEND ONLY).
 * Bu fonksiyon stok değiştirmenin TEK YOLUdur.
 * Doğrudan stok alanı güncellenmez.
 *
 * @param movement - Hareket detayları
 * @returns Eklenen hareket kaydının ID'si
 */
export const addStockMovement = async (
  movement: StockMovement
): Promise<string> => {
  const supabase = await createClient();

  if (movement.quantity <= 0) {
    throw new Error("Miktar sıfırdan büyük olmalıdır.");
  }

  const { data, error } = await supabase
    .from("stock_movements")
    .insert({
      product_id: movement.product_id,
      warehouse_id: movement.warehouse_id,
      direction: movement.direction,
      quantity: movement.quantity,
      lot_no: movement.lot_no ?? null,
      source_type: movement.source_type,
      source_id: movement.source_id ?? null,
      note: movement.note ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Stok hareketi eklenemedi: ${error.message}`);
  }

  return data.id as string;
};

/**
 * Toplam stok miktarını getirir (tüm depolar toplamı).
 * @param productId - Ürün ID
 * @returns Toplam stok miktarı
 */
export const getTotalStock = async (productId: string): Promise<number> => {
  const stocks = await getStock(productId);
  return stocks.reduce((sum, s) => sum + s.qty, 0);
};
