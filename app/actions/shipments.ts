"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { z } from "@/lib/zod";
import { one } from "@/lib/utils";

const shipmentSchema = z.object({
  order_id: z.string().uuid(),
  warehouse_id: z.string().uuid("Depo seçin"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçersiz"),
  address: z.string().trim().max(500).optional().nullable(),
  vehicle: z.string().trim().max(20).optional().nullable(),
  driver: z.string().trim().max(80).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  lines: z
    .array(z.object({ item_id: z.string().uuid(), qty: z.number().min(0, "Miktar negatif olamaz"), lot_no: z.string().trim().max(60).optional().nullable() }))
    .min(1),
});
export type ShipmentValues = z.infer<typeof shipmentSchema>;

const refresh = () => {
  revalidatePath("/siparisler");
  revalidatePath("/siparisler/sevkiyat");
  revalidatePath("/siparisler/ihtiyac");
  revalidatePath("/depo");
};

/** Sevk ekranı: sipariş + kalan miktarlar + depolar + depo/lot bazında stok */
export async function getShipmentFormData(orderId: string) {
  await requirePermission("order:read");
  const supabase = await createClient();
  const [orderRes, warehousesRes] = await Promise.all([
    supabase.from("orders").select("id, no, status, delivery_date, partner:partners(id, name, address), items:order_items(id, product_id, quantity, delivered_qty, product:products(code, name, unit))").eq("id", orderId).single(),
    supabase.from("warehouses").select("id, name, type").order("name"),
  ]);
  if (orderRes.error) throw new Error("Sipariş getirilemedi: " + orderRes.error.message);
  if (warehousesRes.error) throw new Error(warehousesRes.error.message);
  const productIds = [...new Set((orderRes.data.items ?? []).map((i) => i.product_id))];
  const lotsRes = productIds.length
    ? await supabase.from("v_stock_lot").select("product_id, warehouse_id, lot_no, qty").in("product_id", productIds).gt("qty", 0)
    : { data: [], error: null };
  if (lotsRes.error) throw new Error(lotsRes.error.message);
  const stockRes = productIds.length ? await supabase.from("v_stock").select("product_id, warehouse_id, qty").in("product_id", productIds) : { data: [], error: null };
  if (stockRes.error) throw new Error(stockRes.error.message);
  return { order: orderRes.data, warehouses: warehousesRes.data ?? [], lots: lotsRes.data ?? [], stock: stockRes.data ?? [] };
}
export type ShipmentFormData = Awaited<ReturnType<typeof getShipmentFormData>>;

export async function createShipment(values: ShipmentValues) {
  await requirePermission("stock:write");
  const parsed = shipmentSchema.safeParse(values);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz sevkiyat bilgisi.");
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_shipment", {
    p_order_id: v.order_id,
    p_warehouse_id: v.warehouse_id,
    p_date: v.date,
    p_lines: v.lines.filter((l) => l.qty > 0).map((l) => ({ item_id: l.item_id, qty: l.qty, lot_no: l.lot_no || null })),
    p_address: v.address || undefined,
    p_vehicle: v.vehicle || undefined,
    p_driver: v.driver || undefined,
    p_note: v.note || undefined,
  });
  if (error) throw new Error(error.message);
  refresh();
  return data as string;
}

export async function cancelShipment(id: string) {
  await requirePermission("stock:write");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_shipment", { p_id: id });
  if (error) throw new Error(error.message);
  refresh();
}

export async function getShipments() {
  await requirePermission("order:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select("id, no, ship_date, vehicle_plate, cancelled_at, order:orders(id, no), partner:partners(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Sevkiyatlar getirilemedi: " + error.message);
  return data.map((s) => ({ ...s, order: one(s.order), partner: one(s.partner) }));
}

/** İrsaliye: başlık + satırlar (fişin çıkış hareketleri) */
export async function getShipment(id: string) {
  await requirePermission("order:read");
  const supabase = await createClient();
  const { data: s, error } = await supabase
    .from("shipments")
    .select("*, order:orders(id, no, order_date), partner:partners(name, address, phone), warehouse:warehouses(name), creator:profiles!shipments_created_by_fkey(name)")
    .eq("id", id)
    .single();
  if (error) throw new Error("İrsaliye getirilemedi: " + error.message);
  const lines = s.document_id
    ? await supabase
        .from("stock_movements")
        .select("id, quantity, lot_no, product:products(code, name, unit)")
        .eq("document_id", s.document_id)
        .eq("direction", "out")
        .order("created_at")
    : { data: [], error: null };
  if (lines.error) throw new Error(lines.error.message);
  return {
    shipment: { ...s, order: one(s.order), partner: one(s.partner), warehouse: one(s.warehouse), creator: one(s.creator) },
    lines: (lines.data ?? []).map((l) => ({ ...l, product: one(l.product) })),
  };
}
export type ShipmentDetail = Awaited<ReturnType<typeof getShipment>>;
