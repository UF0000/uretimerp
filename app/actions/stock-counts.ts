"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { readAll } from "@/lib/supabase/read-all";
import { z } from "@/lib/zod";
import { one } from "@/lib/utils";
import { CATEGORY_LABELS, PRODUCT_TYPE_LABELS, type ProductType } from "@/lib/product-meta";

const createSchema = z.object({
  warehouse_id: z.string().uuid("Depo seçin"),
  count_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçersiz"),
  types: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  group_codes: z.array(z.string()).default([]),
  /** Stoğu olmayan (filtreye uyan) ürünleri de listeye ekle */
  include_zero: z.boolean().default(false),
  note: z.string().trim().max(500).optional().nullable(),
});
export type CreateCountValues = z.input<typeof createSchema>;

/**
 * Depodaki stok, ürün × lot bazında. v_stock_lot yalnızca lotlu hareketleri içerir;
 * lotsuz kısım = ürün toplamı (v_stock) − lotlu toplam.
 */
async function warehouseBalances(supabase: Awaited<ReturnType<typeof createClient>>, warehouseId: string, productId?: string) {
  const [lots, totals] = await Promise.all([
    readAll((from, to) => {
      let q = supabase.from("v_stock_lot").select("product_id, lot_no, qty").eq("warehouse_id", warehouseId);
      if (productId) q = q.eq("product_id", productId);
      return q.order("product_id").order("lot_no").range(from, to);
    }, "Lot stoğu okunamadı"),
    readAll((from, to) => {
      let q = supabase.from("v_stock").select("product_id, qty").eq("warehouse_id", warehouseId);
      if (productId) q = q.eq("product_id", productId);
      return q.order("product_id").range(from, to);
    }, "Stok okunamadı"),
  ]);
  const out: { product_id: string; lot_no: string | null; qty: number }[] = [];
  const lotSum = new Map<string, number>();
  for (const l of lots) {
    if (!l.product_id) continue;
    out.push({ product_id: l.product_id, lot_no: l.lot_no, qty: Number(l.qty ?? 0) });
    lotSum.set(l.product_id, (lotSum.get(l.product_id) ?? 0) + Number(l.qty ?? 0));
  }
  for (const t of totals) {
    if (!t.product_id) continue;
    const rest = Math.round((Number(t.qty ?? 0) - (lotSum.get(t.product_id) ?? 0)) * 10000) / 10000;
    if (rest !== 0) out.push({ product_id: t.product_id, lot_no: null, qty: rest });
  }
  return out;
}

const refresh = (id?: string) => {
  revalidatePath("/depo/sayim");
  if (id) revalidatePath(`/depo/sayim/${id}`);
  revalidatePath("/depo");
};

export async function getStockCounts() {
  await requirePermission("master-data:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_counts")
    .select("id, no, count_date, status, scope, created_at, warehouse:warehouses(name), lines:stock_count_lines(counted_qty, adjusted_qty)")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Sayımlar getirilemedi: " + error.message);
  return data.map((c) => ({
    id: c.id,
    no: c.no,
    date: c.count_date,
    status: c.status,
    scope: c.scope,
    warehouse: one(c.warehouse)?.name ?? "—",
    total: c.lines?.length ?? 0,
    counted: (c.lines ?? []).filter((l) => l.counted_qty !== null).length,
    differences: (c.lines ?? []).filter((l) => l.adjusted_qty !== null && Number(l.adjusted_qty) !== 0).length,
  }));
}
export type StockCountRow = Awaited<ReturnType<typeof getStockCounts>>[number];

/** Yeni sayım: seçilen depodaki (filtreye uyan) stok lot bazında listeye alınır */
export async function createStockCount(values: CreateCountValues) {
  await requirePermission("stock:write");
  const parsed = createSchema.safeParse(values);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz sayım bilgisi.");
  const v = parsed.data;
  const supabase = await createClient();

  const products = await readAll(
    (from, to) => {
      let q = supabase.from("products").select("id, type, category, group_code").eq("active", true);
      if (v.types.length) q = q.in("type", v.types as ProductType[]);
      if (v.categories.length) q = q.in("category", v.categories);
      if (v.group_codes.length) q = q.in("group_code", v.group_codes);
      return q.order("id").range(from, to);
    },
    "Ürünler okunamadı",
  );
  const allowed = new Set(products.map((p) => p.id));
  const lines = new Map<string, { product_id: string; lot_no: string | null; system_qty: number }>();
  for (const b of await warehouseBalances(supabase, v.warehouse_id)) {
    if (!allowed.has(b.product_id) || b.qty === 0) continue;
    lines.set(`${b.product_id}|${b.lot_no ?? ""}`, { product_id: b.product_id, lot_no: b.lot_no, system_qty: b.qty });
  }
  if (v.include_zero) {
    const withStock = new Set([...lines.values()].map((l) => l.product_id));
    for (const p of products) if (!withStock.has(p.id)) lines.set(`${p.id}|`, { product_id: p.id, lot_no: null, system_qty: 0 });
  }
  if (lines.size === 0) throw new Error("Bu depoda seçilen ölçütlere uyan stok yok. Filtreleri genişletin ya da “stoğu olmayanları da ekle”yi açın.");

  const scope = [
    v.types.length ? `Tür: ${v.types.map((t) => PRODUCT_TYPE_LABELS[t as ProductType] ?? t).join(", ")}` : "",
    v.categories.length ? `Aile: ${v.categories.map((c) => CATEGORY_LABELS[c] ?? c).join(", ")}` : "",
    v.group_codes.length ? `Grup: ${v.group_codes.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const { data: count, error } = await supabase
    .from("stock_counts")
    .insert({ no: "", warehouse_id: v.warehouse_id, count_date: v.count_date, scope: scope || "Tüm ürünler", note: v.note || null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const rows = [...lines.values()].map((l) => ({ ...l, count_id: count.id }));
  for (let i = 0; i < rows.length; i += 500) {
    const res = await supabase.from("stock_count_lines").insert(rows.slice(i, i + 500));
    if (res.error) {
      await supabase.from("stock_counts").delete().eq("id", count.id);
      throw new Error("Sayım listesi oluşturulamadı: " + res.error.message);
    }
  }
  refresh();
  return count.id;
}

export async function getStockCount(id: string) {
  await requirePermission("master-data:read");
  const supabase = await createClient();
  const [countRes, lines] = await Promise.all([
    supabase
      .from("stock_counts")
      .select("*, warehouse:warehouses(name), creator:profiles!stock_counts_created_by_fkey(name), completer:profiles!stock_counts_completed_by_fkey(name), in_doc:stock_documents!stock_counts_in_document_id_fkey(no), out_doc:stock_documents!stock_counts_out_document_id_fkey(no)")
      .eq("id", id)
      .single(),
    readAll(
      (from, to) =>
        supabase
          .from("stock_count_lines")
          .select("id, product_id, lot_no, system_qty, counted_qty, adjusted_qty, added_manually, note, product:products(code, name, unit, group_code)")
          .eq("count_id", id)
          .order("id")
          .range(from, to),
      "Sayım satırları okunamadı",
    ),
  ]);
  if (countRes.error) throw new Error("Sayım getirilemedi: " + countRes.error.message);
  const c = countRes.data;
  return {
    count: { ...c, warehouse: one(c.warehouse), creator: one(c.creator), completer: one(c.completer), inDoc: one(c.in_doc), outDoc: one(c.out_doc) },
    lines: lines
      .map((l) => ({ ...l, product: one(l.product) }))
      .sort((a, b) => (a.product?.code ?? "").localeCompare(b.product?.code ?? "", "tr", { numeric: true }) || (a.lot_no ?? "").localeCompare(b.lot_no ?? "")),
  };
}
export type StockCountDetail = Awaited<ReturnType<typeof getStockCount>>;

/** Sayılan miktar (boş = sayılmadı) */
export async function saveCountedQty(lineId: string, qty: number | null) {
  await requirePermission("stock:write");
  if (qty !== null && (!Number.isFinite(qty) || qty < 0)) throw new Error("Sayılan miktar 0 veya daha büyük olmalıdır.");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("stock_count_lines")
    .update({ counted_qty: qty, counted_by: qty === null ? null : auth.user?.id ?? null, counted_at: qty === null ? null : new Date().toISOString() })
    .eq("id", lineId);
  if (error) throw new Error(error.message);
}

/** Listede olmayan ürün / lot bulunduysa kalem ekler (sistem stoğu o anki miktar) */
export async function addCountLine(countId: string, productId: string, lotNo: string | null) {
  await requirePermission("stock:write");
  const supabase = await createClient();
  const { data: count, error: cErr } = await supabase.from("stock_counts").select("warehouse_id").eq("id", countId).single();
  if (cErr) throw new Error(cErr.message);
  const lot = lotNo?.trim() || null;
  const balance = (await warehouseBalances(supabase, count.warehouse_id, productId)).find((b) => b.lot_no === lot);
  const { error } = await supabase
    .from("stock_count_lines")
    .insert({ count_id: countId, product_id: productId, lot_no: lot, system_qty: balance?.qty ?? 0, added_manually: true });
  if (error) throw new Error(error.code === "23505" ? "Bu ürün / lot zaten listede." : error.message);
  refresh(countId);
}

export async function completeStockCount(id: string) {
  await requirePermission("stock:write");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_stock_count", { p_id: id });
  if (error) throw new Error(error.message);
  refresh(id);
  revalidatePath("/depo/fisler");
  return data as { fazla: number; eksik: number };
}

export async function cancelStockCount(id: string) {
  await requirePermission("stock:write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("stock_counts").update({ status: "cancelled" }).eq("id", id).eq("status", "open").select("id");
  if (error) throw new Error(error.message);
  if (!data.length) throw new Error("Yalnızca açık sayım iptal edilebilir.");
  refresh(id);
}
