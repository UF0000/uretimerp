"use server";

import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/utils";

/** Arama kutusu için son üretilen lotlar. */
export async function getRecentLots(limit = 15) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lots")
    .select("lot_no, production_date, product:products(code, name)")
    .order("production_date", { ascending: false })
    .order("lot_no", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Lotlar getirilirken hata oluştu: " + error.message);
  return data.map((l) => ({ ...l, product: one(l.product) }));
}

/**
 * Lot soyağacı.
 * Geriye: lot → iş emri, reçete, vardiya girişi, tüketilen hammadde, olası reçine lotları.
 * İleriye: aynı lot numaralı tüm stok hareketleri (depo, sevk, fire), kalite kontrol, NCR.
 */
export async function getLotTrace(lotNo: string) {
  const supabase = await createClient();
  const lot = lotNo.trim();

  const [lotRes, entryRes, movementsRes, qcRes, ncrRes] = await Promise.all([
    supabase.from("lots").select("*, product:products(code, name, unit)").eq("lot_no", lot).maybeSingle(),
    supabase
      .from("production_entries")
      .select(`
        *,
        scrap_reason:reason_codes!production_entries_scrap_reason_code_id_fkey(code, label),
        downtime_reason:reason_codes!production_entries_downtime_reason_code_id_fkey(code, label),
        user:profiles(name)
      `)
      .eq("lot_no", lot)
      .maybeSingle(),
    supabase
      .from("stock_movements")
      .select(`
        id, created_at, direction, quantity, source_type, note, reverses_id,
        product:products(code, name, unit),
        warehouse:warehouses(name, type),
        document:stock_documents(no, type)
      `)
      .eq("lot_no", lot)
      .order("created_at"),
    supabase
      .from("quality_checks")
      .select("id, type, result, standard, checked_at, product:products(code)")
      .eq("lot_no", lot)
      .order("checked_at"),
    supabase
      .from("ncr")
      .select("id, no, status, description, quantity, created_at")
      .eq("lot_no", lot)
      .order("created_at"),
  ]);

  for (const res of [lotRes, entryRes, movementsRes, qcRes, ncrRes]) {
    if (res.error) throw new Error("İzlenebilirlik verileri getirilirken hata oluştu: " + res.error.message);
  }

  const lotRow = lotRes.data;
  const entry = entryRes.data;

  // İş emri + reçete + makine
  const workOrderId = lotRow?.work_order_id ?? entry?.work_order_id ?? null;
  const { data: workOrder } = workOrderId
    ? await supabase
        .from("work_orders")
        .select("no, planned_qty, status, bom:boms(code, name, version, production_type), line:production_lines(name, code), mold:molds(name, code)")
        .eq("id", workOrderId)
        .maybeSingle()
    : { data: null };

  // Geriye: bu vardiya girişinde tüketilen hammadde (kesin bağlantı)
  const { data: consumed } = entry
    ? await supabase
        .from("stock_movements")
        .select("product_id, quantity, lot_no, created_at, product:products(code, name, unit)")
        .eq("production_entry_id", entry.id)
        .eq("direction", "out")
    : { data: [] };

  // Olası reçine lotları: sadece lotu kaydedilmemiş tüketimler için, üretimden önce giren lotlu girişler
  const productionTime = entry?.entry_time ?? null;
  const rawIds = [...new Set((consumed ?? []).filter((c) => !c.lot_no).map((c) => c.product_id))];
  const { data: candidates } =
    rawIds.length && productionTime
      ? await supabase
          .from("stock_movements")
          .select("product_id, lot_no, quantity, created_at, source_type, product:products(code)")
          .in("product_id", rawIds)
          .eq("direction", "in")
          .not("lot_no", "is", null)
          .is("reverses_id", null)
          .lte("created_at", productionTime)
          .order("created_at", { ascending: false })
          .limit(30)
      : { data: [] };

  // İleriye (hammadde lotu): bu lottan tüketen vardiya girişleri ve ürettikleri lotlar
  const { data: usedIn, error: usedInError } = await supabase
    .from("stock_movements")
    .select(`
      quantity, created_at,
      entry:production_entries(lot_no, produced_qty, work_order:work_orders(no, product:products(code, name, unit)))
    `)
    .eq("lot_no", lot)
    .eq("direction", "out")
    .not("production_entry_id", "is", null)
    .is("reverses_id", null)
    .order("created_at");
  if (usedInError) throw new Error("Lot kullanımı getirilirken hata oluştu: " + usedInError.message);

  const reversedIds = new Set((movementsRes.data ?? []).map((m) => m.reverses_id).filter(Boolean));

  return {
    lotNo: lot,
    found: Boolean(lotRow || entry || movementsRes.data?.length),
    lot: lotRow ? { ...lotRow, product: one(lotRow.product) } : null,
    workOrder: workOrder
      ? { ...workOrder, bom: one(workOrder.bom), line: one(workOrder.line), mold: one(workOrder.mold) }
      : null,
    entry: entry
      ? {
          ...entry,
          scrap_reason: one(entry.scrap_reason),
          downtime_reason: one(entry.downtime_reason),
          user: one(entry.user),
        }
      : null,
    consumed: (consumed ?? []).map((c) => ({ ...c, product: one(c.product) })),
    candidateLots: (candidates ?? []).map((c) => ({ ...c, product: one(c.product) })),
    movements: (movementsRes.data ?? []).map((m) => ({
      ...m,
      product: one(m.product),
      warehouse: one(m.warehouse),
      document: one(m.document),
      isReversed: reversedIds.has(m.id),
    })),
    usedInLots: (usedIn ?? []).map((u) => {
      const e = one(u.entry);
      const wo = one(e?.work_order);
      return {
        quantity: Number(u.quantity),
        createdAt: u.created_at,
        lotNo: e?.lot_no ?? null,
        workOrderNo: wo?.no ?? null,
        product: one(wo?.product) ?? null,
        producedQty: Number(e?.produced_qty ?? 0),
      };
    }),
    qualityChecks: (qcRes.data ?? []).map((q) => ({ ...q, product: one(q.product) })),
    ncrs: ncrRes.data ?? [],
  };
}

export type LotTrace = Awaited<ReturnType<typeof getLotTrace>>;
