"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { one } from "@/lib/utils";
import { inChunks, readAll } from "@/lib/supabase/read-all";
import {
  draftsFromSuggestionSchema,
  purchaseOrderSchema,
  receiptSchema,
  type DraftsFromSuggestion,
  type PurchaseOrderValues,
  type ReceiptValues,
} from "@/lib/validations/purchase";

const refresh = () => {
  revalidatePath("/siparisler/satin-alma");
  revalidatePath("/siparisler/ihtiyac");
  revalidatePath("/depo");
};

/** Liste: sipariş + tedarikçi + satır toplamları (teslim durumu hesaplı) */
export async function getPurchaseOrders() {
  await requirePermission("order:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("id, no, status, order_date, expected_date, currency, note, created_at, partner:partners(id, name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Satın alma siparişleri getirilemedi: " + error.message);
  // Satırlar (teslim alınan / kalan hesaplı görünüm) sipariş başına gruplanır
  const lines = await inChunks(
    data.map((p) => p.id),
    200,
    (ids) => supabase.from("v_purchase_order_items").select("purchase_order_id, quantity, unit_price, received_qty, remaining_qty").in("purchase_order_id", ids),
  );
  const byPo = new Map<string, typeof lines>();
  for (const l of lines) if (l.purchase_order_id) byPo.set(l.purchase_order_id, [...(byPo.get(l.purchase_order_id) ?? []), l]);
  return data.map((po) => {
    const items = byPo.get(po.id) ?? [];
    const total = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price ?? 0), 0);
    const ordered = items.reduce((s, i) => s + Number(i.quantity), 0);
    const received = items.reduce((s, i) => s + Number(i.received_qty ?? 0), 0);
    return {
      id: po.id,
      no: po.no,
      status: po.status,
      orderDate: po.order_date,
      expectedDate: po.expected_date,
      currency: po.currency,
      note: po.note,
      partner: one(po.partner),
      itemCount: items.length,
      total,
      delivery: received <= 0 ? ("none" as const) : items.every((i) => Number(i.remaining_qty) <= 0) ? ("full" as const) : ("partial" as const),
      receivedPct: ordered > 0 ? Math.min(1, received / ordered) : 0,
    };
  });
}
export type PurchaseOrderRow = Awaited<ReturnType<typeof getPurchaseOrders>>[number];

export async function getPurchaseOrder(id: string) {
  await requirePermission("order:read");
  const supabase = await createClient();
  const [poRes, itemsRes] = await Promise.all([
    supabase.from("purchase_orders").select("*, partner:partners(id, name), creator:profiles!purchase_orders_created_by_fkey(name)").eq("id", id).single(),
    supabase.from("v_purchase_order_items").select("id, product_id, quantity, unit_price, note, received_qty, remaining_qty").eq("purchase_order_id", id),
  ]);
  if (poRes.error) throw new Error("Satın alma siparişi getirilemedi: " + poRes.error.message);
  if (itemsRes.error) throw new Error("Sipariş kalemleri getirilemedi: " + itemsRes.error.message);
  // Görünümden ürün ilişkisi kurulamadığı için ürün kartları ayrı okunur
  const productIds = [...new Set((itemsRes.data ?? []).map((i) => i.product_id).filter((x): x is string => Boolean(x)))];
  const productsRes = productIds.length ? await supabase.from("products").select("id, code, name, unit").in("id", productIds) : { data: [], error: null };
  if (productsRes.error) throw new Error(productsRes.error.message);
  const productById = new Map((productsRes.data ?? []).map((p) => [p.id, p]));
  const items = (itemsRes.data ?? []).map((i) => ({ ...i, product: (i.product_id && productById.get(i.product_id)) || null }));
  // Teslim alma hareketleri (iptal edilen fişlerin ters kayıtları dahil)
  const itemIds = items.map((i) => i.id).filter((x): x is string => Boolean(x));
  const moves = itemIds.length
    ? await supabase
        .from("stock_movements")
        .select("id, quantity, direction, lot_no, created_at, source_id, document:stock_documents(no, document_date, cancelled_at), warehouse:warehouses(name)")
        .eq("source_type", "purchase")
        .in("source_id", itemIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (moves.error) throw new Error("Teslim kayıtları getirilemedi: " + moves.error.message);
  return { po: poRes.data, items, receipts: moves.data ?? [] };
}
export type PurchaseOrderDetail = Awaited<ReturnType<typeof getPurchaseOrder>>;

/** Taslak sipariş oluşturur / taslağı günceller (kalemler baştan yazılır) */
export async function savePurchaseOrder(values: PurchaseOrderValues) {
  await requirePermission("order:write");
  const parsed = purchaseOrderSchema.safeParse(values);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz sipariş.");
  const v = parsed.data;
  const supabase = await createClient();

  let poId = v.id;
  const header = { partner_id: v.partner_id, order_date: v.order_date, expected_date: v.expected_date || null, currency: v.currency, note: v.note || null };
  if (poId) {
    const { data: current } = await supabase.from("purchase_orders").select("status").eq("id", poId).single();
    if (current?.status !== "draft") throw new Error("Yalnızca taslak siparişler düzenlenebilir.");
    const { error } = await supabase.from("purchase_orders").update(header).eq("id", poId);
    if (error) throw new Error(error.message);
    const del = await supabase.from("purchase_order_items").delete().eq("purchase_order_id", poId);
    if (del.error) throw new Error(del.error.message);
  } else {
    const { data, error } = await supabase.from("purchase_orders").insert({ ...header, no: "" }).select("id").single();
    if (error) throw new Error(error.message);
    poId = data.id;
  }
  const { error: itemsError } = await supabase
    .from("purchase_order_items")
    .insert(v.items.map((i) => ({ purchase_order_id: poId!, product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price ?? null, note: i.note || null })));
  if (itemsError) throw new Error("Kalemler kaydedilemedi: " + itemsError.message);
  refresh();
  return poId!;
}

/** Satın alma önerisinden tedarikçi başına taslak siparişler */
export async function createDraftsFromSuggestion(drafts: DraftsFromSuggestion) {
  await requirePermission("order:write");
  const parsed = draftsFromSuggestionSchema.safeParse(drafts);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz öneri.");
  const created: string[] = [];
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
  for (const d of parsed.data) {
    await savePurchaseOrder({ partner_id: d.partner_id, order_date: today, expected_date: d.expected_date ?? null, currency: d.currency, note: "Satın alma önerisinden", items: d.items.map((i) => ({ ...i, note: null })) });
    created.push(d.partner_id);
  }
  refresh();
  return created.length;
}

/** Durum geçişi: taslak → sipariş verildi, sipariş verildi → kapandı (eksik kalsa da), taslak/verildi → iptal */
export async function setPurchaseOrderStatus(id: string, status: "ordered" | "closed" | "cancelled") {
  await requirePermission("order:write");
  const supabase = await createClient();
  const { data: po, error: readError } = await supabase.from("purchase_orders").select("status").eq("id", id).single();
  if (readError) throw new Error(readError.message);
  const allowed: Record<string, string[]> = { draft: ["ordered", "cancelled"], ordered: ["closed", "cancelled"] };
  if (!allowed[po.status]?.includes(status)) throw new Error("Bu durumdaki sipariş için bu işlem yapılamaz.");
  if (status === "cancelled" && po.status === "ordered") {
    const { data: rows } = await supabase.from("v_purchase_order_items").select("received_qty").eq("purchase_order_id", id);
    if ((rows ?? []).some((r) => Number(r.received_qty) > 0)) throw new Error("Teslim alınmış kalemi olan sipariş iptal edilemez; kapatın.");
  }
  const now = new Date().toISOString();
  const patch = status === "ordered" ? { status, ordered_at: now } : { status, closed_at: now };
  const { error } = await supabase.from("purchase_orders").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

/** Taslak siparişi siler (verilmiş sipariş silinmez, iptal edilir) */
export async function deletePurchaseOrder(id: string) {
  await requirePermission("order:write");
  const supabase = await createClient();
  const { data: po } = await supabase.from("purchase_orders").select("status").eq("id", id).single();
  if (po?.status !== "draft") throw new Error("Yalnızca taslak sipariş silinebilir; verilmiş siparişi iptal edin.");
  const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

/** Teslim alma: giriş fişi + stok hareketleri tek işlemde (veritabanı fonksiyonu) */
export async function receivePurchaseOrder(values: ReceiptValues) {
  await requirePermission("stock:write");
  const parsed = receiptSchema.safeParse(values);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz teslim bilgisi.");
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_purchase_order", {
    p_po_id: v.purchase_order_id,
    p_warehouse_id: v.warehouse_id,
    p_date: v.date,
    p_lines: v.lines.filter((l) => l.qty > 0).map((l) => ({ item_id: l.item_id, qty: l.qty, lot_no: l.lot_no || null })),
    p_note: v.note || undefined,
  });
  if (error) throw new Error(error.message);
  refresh();
  revalidatePath("/depo/fisler");
}

/** Form için: tedarikçiler, ürünler, tedarikçi × ürün son fiyatı */
export async function getPurchaseFormData() {
  await requirePermission("order:read");
  const supabase = await createClient();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
  const [partnersRes, productsRes, suppliersRes, warehousesRes] = await Promise.all([
    supabase.from("partners").select("id, name, type").eq("type", "supplier").order("name"),
    readAll((from, to) => supabase.from("products").select("id, code, name, unit, type").eq("active", true).order("code").order("id").range(from, to), "Ürünler okunamadı"),
    supabase.from("product_suppliers").select("product_id, partner_id, prices:supplier_prices(price, currency, valid_from)"),
    supabase.from("warehouses").select("id, name, type").order("name"),
  ]);
  for (const r of [partnersRes, suppliersRes, warehousesRes]) if (r.error) throw new Error(r.error.message);
  // "tedarikçi|ürün" → bugüne kadar geçerli en yeni fiyat
  const prices: Record<string, { price: number; currency: string }> = {};
  for (const s of suppliersRes.data ?? []) {
    const p = (s.prices ?? []).filter((x) => x.valid_from <= today).sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
    if (p) prices[`${s.partner_id}|${s.product_id}`] = { price: Number(p.price), currency: p.currency };
  }
  return { suppliers: partnersRes.data ?? [], products: productsRes, prices, warehouses: warehousesRes.data ?? [] };
}
export type PurchaseFormData = Awaited<ReturnType<typeof getPurchaseFormData>>;
