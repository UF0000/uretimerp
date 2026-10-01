// Simülasyon turu: her bölüm kendi rol hesabıyla, sistemin kendi işlemleriyle iş yapar.
// Son turdan bu yana geçen süre kadar fabrika "çalışır" (üretim girişleri vardiya sınırlarında bölünür).
// Kullanım: node scripts/sim/run.mjs [--hours=1]
// Ortam: SIM_TICK_HOURS (tur aralığı, saat), SIM_LEAD_HOURS (satın alma teslim süresi, saat)
import { appendFileSync } from "node:fs";
import { env, signIn, must, createLog, rnd, rndInt, pick, chance, round, trDate, trMinutes, trWeekday, addDays, hhmmToMin, stamp, nextNo } from "./lib.mjs";
import { PRODUCTS, RAWS, CUSTOMERS, QUARANTINE_WAREHOUSE, FINISHED_WAREHOUSE, RAW_WAREHOUSE } from "./catalog.mjs";

// Yalnızca test veritabanı: canlı adresle çalıştırılmaz
if (env.NEXT_PUBLIC_SUPABASE_URL && new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin === env.SIM_SUPABASE_URL) {
  throw new Error("SIM_SUPABASE_URL canlı veritabanıyla aynı; simülasyon durduruldu.");
}

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const HOURS = Number(arg("hours") ?? env.SIM_TICK_HOURS ?? 1);
const LEAD_HOURS = Number(env.SIM_LEAD_HOURS ?? 3);
const now = new Date();
const today = trDate(now);
const year = today.slice(0, 4);

const log = createLog();
const [admin, operator, warehouse, quality] = await Promise.all(["ADMIN", "OPERATOR", "WAREHOUSE", "QUALITY"].map(signIn));

// ── Ortak veri (okuma yönetici hesabıyla) ──
const catalogByCode = new Map(PRODUCTS.map((p) => [p.code, p]));
const products = must(await admin.from("products").select("id, code, name, unit").in("code", PRODUCTS.map((p) => p.code)), "ürünler");
const productById = new Map(products.map((p) => [p.id, p]));
const catalogOf = (productId) => catalogByCode.get(productById.get(productId)?.code);
const boms = must(
  await admin
    .from("boms")
    .select("id, product_id, code, production_type, items:bom_items(component_product_id, ratio_pct), bom_extrusion(kg_per_meter, target_m_per_hour, scrap_product_id), bom_injection(mold_id, cavity_count, cycle_time_sec, product_weight_g, runner_sprue_weight_g, scrap_product_id)")
    .eq("active", true)
    .in("product_id", products.map((p) => p.id)),
  "reçeteler",
);
const one = (v) => (Array.isArray(v) ? v[0] : v) ?? null;
const bomById = new Map(boms.map((b) => [b.id, b]));
const bomOfProduct = (productId) => boms.find((b) => b.product_id === productId);
const molds = new Map(must(await admin.from("molds").select("id, cavity_count, cycle_time_sec, product_weight_g, sprue_weight_g"), "kalıplar").map((m) => [m.id, m]));

/** Birim hammadde (kg/birim) ve teknik değerler; reçetede boş alan kalıba düşer */
function techOf(bom) {
  const ext = one(bom.bom_extrusion);
  const inj = one(bom.bom_injection);
  if (bom.production_type === "extrusion") {
    return { type: "extrusion", kgPerUnit: Number(ext?.kg_per_meter) || 0, speed: Number(ext?.target_m_per_hour) || 0, scrapProductId: ext?.scrap_product_id ?? null };
  }
  const mold = molds.get(inj?.mold_id) ?? {};
  const pos = (...v) => v.map(Number).find((x) => x > 0) ?? 0;
  const cavity = pos(inj?.cavity_count, mold.cavity_count, 1);
  const cycle = pos(inj?.cycle_time_sec, mold.cycle_time_sec);
  const partG = pos(inj?.product_weight_g, mold.product_weight_g);
  const runnerG = pos(inj?.runner_sprue_weight_g, mold.sprue_weight_g);
  return { type: "injection", kgPerUnit: (partG + runnerG / cavity) / 1000, cavity, cycle, partG, runnerG, scrapProductId: inj?.scrap_product_id ?? null };
}

const warehouses = must(await admin.from("warehouses").select("id, name, type"), "depolar");
const whByName = (name, type) => warehouses.find((w) => w.name === name) ?? warehouses.find((w) => w.type === type);
const RAW_WH = whByName(RAW_WAREHOUSE, "raw");
const FIN_WH = whByName(FINISHED_WAREHOUSE, "finished");
const QUAR_WH = whByName(QUARANTINE_WAREHOUSE, "quarantine");
const lines = must(await admin.from("production_lines").select("id, code, name, status"), "hatlar");
const lineByCode = new Map(lines.map((l) => [l.code, l]));
const reasons = must(await admin.from("reason_codes").select("id, kind, code, label").eq("active", true), "neden kodları");
const scrapReasons = reasons.filter((r) => r.kind === "scrap");
const downReasons = reasons.filter((r) => r.kind === "downtime");
const rawShortReason = downReasons.find((r) => /hammadde kaynakl/i.test(r.label)) ?? downReasons[0];
const operators = must(await admin.from("operators").select("id, name").eq("active", true), "operatörler");
const params = must(await admin.from("cost_parameters").select("weekly_off_days, day_shift_start, night_shift_start").limit(1).maybeSingle(), "parametreler") ?? {};
const DAY_START = hhmmToMin(params.day_shift_start ?? "08:00");
const NIGHT_START = hhmmToMin(params.night_shift_start ?? "20:00");
const OFF_DAYS = new Set(params.weekly_off_days ?? []);

const stockMap = async (warehouseId) =>
  new Map(must(await admin.from("v_stock").select("product_id, qty").eq("warehouse_id", warehouseId), "stok").map((r) => [r.product_id, Number(r.qty)]));

// ════════════════ 1. SATIŞ (yönetici): yeni müşteri siparişleri ════════════════
async function sales() {
  const A = "Satış";
  const open = must(await admin.from("orders").select("id").in("status", ["open", "in_production"]), "açık siparişler");
  const count = open.length === 0 ? 3 : open.length < 8 && chance(Math.min(1, HOURS / 6)) ? 1 : 0;
  const customers = must(await admin.from("partners").select("id, name").eq("type", "customer").in("name", CUSTOMERS), "müşteriler");
  for (let i = 0; i < count; i++) {
    await log.try(A, "Sipariş açılamadı", async () => {
      const chosen = [...products].sort(() => Math.random() - 0.5).slice(0, rndInt(1, 3)).filter((p) => bomOfProduct(p.id));
      const no = await nextNo(admin, "orders", "SS", year);
      const customer = pick(customers);
      const order = must(await admin.from("orders").insert({ no, partner_id: customer.id, order_date: today, delivery_date: trDate(addDays(now, rndInt(5, 15))), status: "open" }).select("id").single(), "sipariş");
      const items = chosen.map((p) => {
        const [min, max, step] = catalogByCode.get(p.code).order;
        return { order_id: order.id, product_id: p.id, quantity: Math.round(rnd(min, max) / step) * step };
      });
      must(await admin.from("order_items").insert(items), "sipariş kalemleri");
      log.ok(A, `${no} ${customer.name}: ${items.map((i) => `${productById.get(i.product_id).code} × ${i.quantity}`).join(", ")}`);
    });
  }
}

// ════════════════ 2. PLANLAMA (operatör): siparişe iş emri ════════════════
async function planning() {
  const A = "Planlama";
  const orders = must(await admin.from("orders").select("id, no, status, items:order_items(product_id, quantity, delivered_qty)").in("status", ["open", "in_production"]), "siparişler");
  const wos = must(await admin.from("work_orders").select("order_id, product_id").neq("status", "cancelled").not("order_id", "is", null), "iş emirleri");
  const has = new Set(wos.map((w) => `${w.order_id}|${w.product_id}`));
  for (const order of orders) {
    let opened = false;
    for (const item of order.items ?? []) {
      const remaining = Number(item.quantity) - Number(item.delivered_qty ?? 0);
      if (remaining <= 0 || has.has(`${order.id}|${item.product_id}`)) continue;
      const bom = bomOfProduct(item.product_id);
      const cat = catalogOf(item.product_id);
      if (!bom || !cat) {
        log.fail(A, `${order.no}: ${productById.get(item.product_id)?.code ?? item.product_id} için iş emri açılamadı`, "aktif reçete yok");
        continue;
      }
      await log.try(A, `${order.no} iş emri açılamadı`, async () => {
        const no = await nextNo(admin, "work_orders", "IE", year);
        must(
          await operator.from("work_orders").insert({ no, product_id: item.product_id, bom_id: bom.id, planned_qty: remaining, line_id: lineByCode.get(cat.line)?.id ?? null, mold_id: one(bom.bom_injection)?.mold_id ?? null, status: "planned", order_id: order.id }),
          "iş emri",
        );
        has.add(`${order.id}|${item.product_id}`);
        opened = true;
        log.ok(A, `${no}: ${cat.code} × ${remaining} (${order.no}, hat ${cat.line})`);
      });
    }
    if (opened && order.status === "open") {
      await log.try("Satış", `${order.no} durumu güncellenemedi`, async () => {
        must(await admin.from("orders").update({ status: "in_production" }).eq("id", order.id).eq("status", "open"), "sipariş durumu");
      });
    }
  }
}

/** Açık iş emirleri ve şimdiye kadarki (iptal edilmemiş) üretimleri */
async function activeWorkOrders() {
  const rows = must(
    await admin
      .from("work_orders")
      .select("id, no, product_id, bom_id, planned_qty, line_id, status, started_at, entries:production_entries(produced_qty, end_at, cancelled_at)")
      .in("status", ["planned", "in_progress"])
      .order("no"),
    "iş emirleri",
  );
  return rows.map((w) => {
    const entries = (w.entries ?? []).filter((e) => !e.cancelled_at);
    return { ...w, produced: entries.reduce((s, e) => s + Number(e.produced_qty), 0) };
  });
}

// ════════════════ 3. SATIN ALMA (yönetici): hammadde eksiğine sipariş ════════════════
async function purchasing() {
  const A = "Satın alma";
  const need = new Map();
  for (const wo of await activeWorkOrders()) {
    const bom = bomById.get(wo.bom_id);
    if (!bom) continue;
    const remaining = Math.max(0, Number(wo.planned_qty) - wo.produced);
    const kg = remaining * techOf(bom).kgPerUnit * 1.04;
    for (const it of bom.items ?? []) need.set(it.component_product_id, (need.get(it.component_product_id) ?? 0) + (kg * Number(it.ratio_pct)) / 100);
  }
  const stock = await stockMap(RAW_WH.id);
  const openPos = must(await admin.from("purchase_orders").select("id").in("status", ["draft", "ordered"]), "açık satın almalar");
  const onOrder = new Map();
  if (openPos.length) {
    for (const r of must(await admin.from("v_purchase_order_items").select("product_id, remaining_qty").in("purchase_order_id", openPos.map((p) => p.id)), "bekleyen teslimler")) {
      onOrder.set(r.product_id, (onOrder.get(r.product_id) ?? 0) + Number(r.remaining_qty));
    }
  }
  const rawCards = must(await admin.from("products").select("id, code, min_stock").in("code", RAWS.map((r) => r.code)), "hammaddeler");
  const ids = new Set([...need.keys(), ...rawCards.map((r) => r.id)]);
  const links = must(
    await admin.from("product_suppliers").select("id, product_id, partner_id, min_order_qty, lead_time_days, is_primary, prices:supplier_prices(price, currency, valid_from)").in("product_id", [...ids]),
    "tedarikçiler",
  );
  const bySupplier = new Map();
  for (const id of ids) {
    const card = rawCards.find((r) => r.id === id);
    const shortage = (need.get(id) ?? 0) + Number(card?.min_stock ?? 0) - (stock.get(id) ?? 0) - (onOrder.get(id) ?? 0);
    if (shortage <= 0) continue;
    const link = links.find((l) => l.product_id === id && l.is_primary) ?? links.find((l) => l.product_id === id);
    if (!link) {
      log.fail(A, `Hammadde eksik (${round(shortage, 0)} kg) ama sipariş verilemedi`, `ürün ${id} için tedarikçi tanımlı değil`);
      continue;
    }
    const moq = Number(link.min_order_qty) || 1;
    const price = [...(link.prices ?? [])].sort((a, b) => String(b.valid_from).localeCompare(String(a.valid_from)))[0];
    const list = bySupplier.get(link.partner_id) ?? [];
    list.push({ product_id: id, quantity: Math.ceil(shortage / moq) * moq, unit_price: price ? Number(price.price) : null, lead: link.lead_time_days ?? 2 });
    bySupplier.set(link.partner_id, list);
  }
  for (const [partnerId, items] of bySupplier) {
    await log.try(A, "Satın alma siparişi verilemedi", async () => {
      const lead = Math.max(...items.map((i) => i.lead));
      const po = must(await admin.from("purchase_orders").insert({ no: "", partner_id: partnerId, order_date: today, expected_date: trDate(addDays(now, lead)), currency: "TRY", note: "Simülasyon: net ihtiyaç" }).select("id, no").single(), "sipariş başlığı");
      must(await admin.from("purchase_order_items").insert(items.map((i) => ({ purchase_order_id: po.id, product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price }))), "sipariş kalemleri");
      must(await admin.from("purchase_orders").update({ status: "ordered", ordered_at: new Date().toISOString() }).eq("id", po.id), "sipariş verildi");
      log.ok(A, `${po.no}: ${items.map((i) => `${rawCards.find((r) => r.id === i.product_id)?.code ?? i.product_id} ${i.quantity} kg`).join(", ")}`);
    });
  }
}

// ════════════════ 4. DEPO: mal kabul ════════════════
async function receiving() {
  const A = "Depo";
  const due = new Date(now.getTime() - LEAD_HOURS * 3600000).toISOString();
  const pos = must(await admin.from("purchase_orders").select("id, no").eq("status", "ordered").lte("ordered_at", due), "teslim bekleyenler");
  for (const po of pos) {
    await log.try(A, `${po.no} teslim alınamadı`, async () => {
      const items = must(await admin.from("v_purchase_order_items").select("id, product_id, remaining_qty").eq("purchase_order_id", po.id).gt("remaining_qty", 0), "kalemler");
      const partial = chance(0.1);
      const lines = items.map((i) => ({ item_id: i.id, qty: round(Number(i.remaining_qty) * (partial ? 0.6 : 1), 0), lot_no: `HM-${stamp(now)}-${rndInt(100, 999)}` }));
      must(await warehouse.rpc("receive_purchase_order", { p_po_id: po.id, p_warehouse_id: RAW_WH.id, p_date: today, p_lines: lines, p_note: partial ? "Kısmi teslim (sim)" : null }), "teslim");
      log.ok(A, `${po.no} teslim alındı${partial ? " (kısmi)" : ""}: ${lines.map((l) => `${l.qty} kg lot ${l.lot_no}`).join(", ")}`);
    });
  }
}

// ════════════════ 5. ÜRETİM (operatör): vardiya girişleri ════════════════
/** Bir sonraki vardiya sınırı (gündüz/gece başlangıcı) */
function nextBoundary(t) {
  const m = trMinutes(t);
  const candidates = [DAY_START, NIGHT_START, DAY_START + 1440].filter((b) => b > m).sort((a, b) => a - b);
  return new Date(t.getTime() + (candidates[0] - m) * 60000 - (t.getUTCSeconds() * 1000 + t.getUTCMilliseconds()));
}
/** Vardiyanın ait olduğu gün (gece vardiyasının sabah kısmı önceki güne) hafta tatili mi */
const isOffShift = (t) => OFF_DAYS.has(trWeekday(trMinutes(t) < DAY_START ? addDays(t, -1) : t));

async function production() {
  const A = "Üretim";
  const wos = await activeWorkOrders();
  const rawStock = await stockMap(RAW_WH.id);
  const usedLines = [...new Set(PRODUCTS.map((p) => p.line))].map((c) => lineByCode.get(c)).filter(Boolean);

  for (const line of usedLines) {
    if (line.status !== "active") continue;
    const lineWos = wos.filter((w) => w.line_id === line.id);
    // Hattın son girişinin bitişi (yoksa tur aralığı kadar geri), en fazla 24 saat geriye
    const lastEnd = must(
      await admin.from("production_entries").select("end_at, work_order:work_orders!inner(line_id)").eq("work_order.line_id", line.id).is("cancelled_at", null).order("end_at", { ascending: false }).limit(1),
      "son giriş",
    )[0]?.end_at;
    let t = new Date(Math.max(lastEnd ? Date.parse(lastEnd) : now.getTime() - HOURS * 3600000, now.getTime() - 24 * 3600000));

    while (now.getTime() - t.getTime() >= 15 * 60000) {
      const segEnd = new Date(Math.min(nextBoundary(t).getTime(), now.getTime()));
      if (isOffShift(t)) {
        t = segEnd;
        continue;
      }
      let wo = lineWos.find((w) => w.status === "in_progress") ?? lineWos.find((w) => w.status === "planned");
      if (!wo) break; // hat boş: iş emri yok
      if (wo.status === "planned") {
        const ok = await log.try(A, `${wo.no} başlatılamadı`, async () => {
          must(await operator.from("work_orders").update({ status: "in_progress", started_at: t.toISOString() }).eq("id", wo.id).eq("status", "planned"), "başlat");
          return true;
        });
        if (!ok) break;
        wo.status = "in_progress";
        log.ok(A, `${wo.no} başlatıldı (${line.name})`);
      }
      const bom = bomById.get(wo.bom_id);
      const tech = techOf(bom);
      const durMin = (segEnd.getTime() - t.getTime()) / 60000;
      const remaining = Math.max(0, Number(wo.planned_qty) - wo.produced);

      // Duruşlar
      let downtimes = [];
      if (chance(0.4)) {
        const n = chance(0.25) ? 2 : 1;
        for (let i = 0; i < n; i++) downtimes.push({ reason_code_id: pick(downReasons).id, minutes: rndInt(10, Math.max(10, Math.min(120, Math.floor(durMin * 0.3)))) });
      }
      let downMin = downtimes.reduce((s, d) => s + d.minutes, 0);
      if (downMin > durMin) {
        downtimes = [{ reason_code_id: downtimes[0].reason_code_id, minutes: Math.floor(durMin) }];
        downMin = Math.floor(durMin);
      }
      const runMin = durMin - downMin;

      // Üretim (hız/çevrim sapmalı)
      let produced;
      let goodKg;
      let cycle = null;
      if (tech.type === "extrusion") {
        produced = Math.floor(tech.speed * rnd(0.82, 1.0) * (runMin / 60));
        goodKg = produced * tech.kgPerUnit * rnd(0.985, 1.04);
      } else {
        cycle = tech.cycle * rnd(1.0, 1.15);
        const shots = Math.floor((runMin * 60) / cycle);
        produced = Math.max(0, shots * tech.cavity - rndInt(0, Math.floor(shots * tech.cavity * 0.02)));
        goodKg = (produced * (tech.partG * rnd(0.99, 1.03) + tech.runnerG / tech.cavity)) / 1000;
      }
      let end = segEnd;
      let close = false;
      if (produced >= remaining && remaining > 0) {
        // İş emri bu vardiyada biter: bitiş, kalan miktarın üretildiği ana çekilir
        const frac = remaining / produced;
        goodKg *= frac;
        produced = Math.ceil(remaining);
        end = new Date(t.getTime() + (downMin + Math.max(15, runMin * frac)) * 60000);
        if (end > segEnd) end = segEnd;
        close = true;
      }
      let scrapKg = produced > 0 && chance(0.85) ? goodKg * rnd(0.005, 0.05) : 0;
      let used = goodKg + scrapKg;

      // Hammadde yetmiyorsa üretim yok, tüm süre "hammadde kaynaklı duruş"
      const short = (bom.items ?? []).find((it) => (rawStock.get(it.component_product_id) ?? 0) < (used * Number(it.ratio_pct)) / 100);
      if (short) {
        produced = 0;
        goodKg = scrapKg = used = 0;
        close = false;
        end = segEnd;
        downtimes = [{ reason_code_id: rawShortReason.id, minutes: Math.floor(durMin) }];
      }
      for (const it of bom.items ?? []) rawStock.set(it.component_product_id, (rawStock.get(it.component_product_id) ?? 0) - (used * Number(it.ratio_pct)) / 100);

      const payload = {
        work_order_id: wo.id,
        replaces_entry_id: null,
        start_at: t.toISOString(),
        end_at: end.toISOString(),
        operator_id: pick(operators)?.id ?? null,
        produced_qty: produced,
        total_used_kg: round(used),
        scraps: scrapKg > 0 ? [{ reason_code_id: pick(scrapReasons).id, kg: round(scrapKg) }] : [],
        downtimes,
        scrap_product_id: scrapKg > 0 ? tech.scrapProductId : null,
        target_warehouse_id: produced > 0 ? FIN_WH.id : null,
        close_work_order: close,
        raw_lots: {},
      };
      const res = await log.try(A, `${wo.no} girişi kaydedilemedi`, async () => must(await operator.rpc("save_production_entry", { p: payload }), "giriş"));
      if (!res) break; // aynı hatayı tekrar etmemek için bu hat bu tur durur
      const label = productById.get(wo.product_id)?.code;
      const hhmm = (d) => new Date(d.getTime() + 3 * 3600000).toISOString().slice(11, 16);
      log.ok(
        A,
        `${line.name} ${wo.no} ${label} ${hhmm(t)}–${hhmm(end)}: ${short ? "hammadde yok, duruş" : `${produced} ${productById.get(wo.product_id)?.unit}, fire ${round(scrapKg, 1)} kg, duruş ${downMin} dk`}${res.lot_no ? `, lot ${res.lot_no}` : ""}${res.closed ? " → iş emri kapandı" : ""}`,
      );
      wo.produced += produced;
      if (res.closed) {
        wo.status = "done";
        lineWos.splice(lineWos.indexOf(wo), 1);
      }
      t = end;
    }
  }
}

// ════════════════ 6. KALİTE: final + giriş kontrolü, NCR ════════════════
async function qualityControl() {
  const A = "Kalite";
  const since = trDate(addDays(now, -2));
  const lots = must(await admin.from("lots").select("lot_no, product_id, work_order_id").not("work_order_id", "is", null).gte("production_date", since), "üretim lotları");
  const checked = new Set(must(await admin.from("quality_checks").select("lot_no").gte("checked_at", addDays(now, -3).toISOString()), "kontroller").map((q) => q.lot_no));
  const finLots = must(await admin.from("v_stock_lot").select("product_id, lot_no, qty").eq("warehouse_id", FIN_WH.id).gt("qty", 0), "mamul lotları");

  for (const lot of lots.filter((l) => !checked.has(l.lot_no))) {
    await log.try(A, `${lot.lot_no} kontrol kaydedilemedi`, async () => {
      const p = productById.get(lot.product_id);
      const cat = catalogOf(lot.product_id);
      const r = Math.random();
      const result = r < 0.04 ? "reject" : r < 0.1 ? "conditional" : "accept";
      const measurements = cat?.type === "extrusion" ? { dis_cap_sapma_mm: round(rnd(-0.1, 0.4), 2), et_sapma_mm: round(rnd(-0.05, 0.3), 2), gorunus: result === "accept" ? "uygun" : "yüzeyde iz" } : { agirlik_sapma_pct: round(rnd(-1, 3), 1), capak: result === "accept" ? "yok" : "var" };
      const standard = cat?.code.startsWith("A1A") ? "TS EN ISO 15874" : cat?.type === "extrusion" ? "TS EN 1519" : "Kalıp ölçü föyü";
      const qc = must(await quality.from("quality_checks").insert({ type: "final", product_id: lot.product_id, work_order_id: lot.work_order_id, lot_no: lot.lot_no, standard, result, measurements, checked_by: (await quality.auth.getUser()).data.user?.id }).select("id").single(), "kontrol");
      log.ok(A, `${lot.lot_no} ${p?.code}: ${result === "accept" ? "kabul" : result === "conditional" ? "şartlı kabul" : "RED"}`);
      if (result !== "reject") return;
      const inStock = Number(finLots.find((f) => f.lot_no === lot.lot_no && f.product_id === lot.product_id)?.qty ?? 0);
      const qty = Math.floor(inStock * rnd(0.2, 0.6));
      if (qty <= 0) return;
      const ncr = must(
        await quality.rpc("create_ncr", { p_product_id: lot.product_id, p_description: `Final kontrolde ölçü dışı (sim): ${JSON.stringify(measurements)}`, p_quantity: qty, p_lot_no: lot.lot_no, p_quality_check_id: qc.id, p_source_warehouse_id: FIN_WH.id, p_quarantine_warehouse_id: QUAR_WH?.id ?? null }),
        "NCR",
      );
      log.ok(A, `NCR ${ncr.no}: ${lot.lot_no} ${qty} ${p?.unit} karantinaya`);
    });
  }

  // Giriş kontrolü: son 2 günde gelen hammadde lotları
  const rawLots = must(await admin.from("v_stock_lot").select("product_id, lot_no, first_in_at").eq("warehouse_id", RAW_WH.id).gte("first_in_at", addDays(now, -2).toISOString()), "hammadde lotları");
  for (const lot of rawLots.filter((l) => !checked.has(l.lot_no))) {
    await log.try(A, `${lot.lot_no} giriş kontrolü kaydedilemedi`, async () => {
      const result = chance(0.97) ? "accept" : "conditional";
      must(await quality.from("quality_checks").insert({ type: "incoming", product_id: lot.product_id, lot_no: lot.lot_no, standard: "Tedarikçi sertifikası + MFI", result, measurements: { mfi: round(rnd(0.2, 0.35), 2), nem_pct: round(rnd(0.01, 0.05), 3) }, checked_by: (await quality.auth.getUser()).data.user?.id }), "giriş kontrolü");
      log.ok(A, `Giriş kontrolü ${lot.lot_no}: ${result === "accept" ? "kabul" : "şartlı kabul"}`);
    });
  }

  // 6 saatten eski açık NCR'ler kapatılır
  const open = must(await admin.from("ncr").select("id, no, quarantine_warehouse_id").eq("status", "open").lte("created_at", new Date(now.getTime() - 6 * 3600000).toISOString()), "açık NCR");
  const causes = [
    ["Kalıp/kalibre sıcaklığı dalgalandı", "Sıcaklık kontrol aralığı daraltıldı, vardiya başı kontrol eklendi"],
    ["Hammadde nemi yüksek", "Kurutucu süresi artırıldı, giriş kontrolüne nem ölçümü eklendi"],
    ["Çekici hızı ayarı kaydı", "Hız ayarı kilitlendi, operatör eğitimi verildi"],
  ];
  for (const n of open) {
    await log.try(A, `${n.no} kapatılamadı`, async () => {
      const [cause, action] = pick(causes);
      const disposition = n.quarantine_warehouse_id ? (chance(0.6) ? "release" : "scrap") : null;
      must(await quality.rpc("close_ncr", { p_id: n.id, p_root_cause: cause, p_corrective_action: action, p_disposition: disposition, p_release_warehouse_id: disposition === "release" ? FIN_WH.id : null }), "NCR kapat");
      log.ok(A, `${n.no} kapatıldı (${disposition === "release" ? "serbest bırakıldı" : disposition === "scrap" ? "imha" : "karantinasız"})`);
    });
  }
}

// ════════════════ 7. DEPO: sevkiyat ════════════════
async function shipping() {
  const A = "Depo";
  const orders = must(await admin.from("orders").select("id, no, delivery_date, partner:partners(address), items:order_items(id, product_id, quantity, delivered_qty)").in("status", ["open", "in_production"]).order("delivery_date"), "siparişler");
  const lots = must(await admin.from("v_stock_lot").select("product_id, lot_no, qty, first_in_at").eq("warehouse_id", FIN_WH.id).gt("qty", 0).order("first_in_at"), "mamul lotları");
  for (const order of orders) {
    const lines = [];
    for (const item of order.items ?? []) {
      let remaining = Number(item.quantity) - Number(item.delivered_qty ?? 0);
      const available = lots.filter((l) => l.product_id === item.product_id).reduce((s, l) => s + Number(l.qty), 0);
      if (remaining <= 0 || available <= 0 || available < remaining * 0.5) continue; // yarısı yoksa beklenir
      for (const lot of lots.filter((l) => l.product_id === item.product_id && Number(l.qty) > 0)) {
        if (remaining <= 0) break;
        const qty = Math.min(remaining, Number(lot.qty));
        lines.push({ item_id: item.id, qty: round(qty), lot_no: lot.lot_no });
        lot.qty = Number(lot.qty) - qty;
        remaining -= qty;
      }
    }
    if (!lines.length) continue;
    await log.try(A, `${order.no} sevk edilemedi`, async () => {
      const plate = `${pick(["34", "35", "06", "16", "41"])} ${pick(["ABC", "KLM", "TRS", "PRT"])} ${rndInt(100, 999)}`;
      const id = must(await warehouse.rpc("create_shipment", { p_order_id: order.id, p_warehouse_id: FIN_WH.id, p_date: today, p_lines: lines, p_address: one(order.partner)?.address ?? null, p_vehicle: plate, p_driver: pick(["Mehmet Y.", "Ali K.", "Hasan D.", "Veli S."]), p_note: "Simülasyon sevkiyatı" }), "sevkiyat");
      const ship = must(await admin.from("shipments").select("no").eq("id", id).single(), "irsaliye");
      log.ok(A, `${order.no} sevk edildi: ${ship.no} (${lines.length} satır, ${plate})`);
    });
  }
}

// ════════════════ 8. DEPO: haftalık hammadde sayımı ════════════════
async function stockCount() {
  const A = "Depo";
  const recent = must(await admin.from("stock_counts").select("id").gte("created_at", addDays(now, -7).toISOString()).neq("status", "cancelled"), "sayımlar");
  const tm = trMinutes(now);
  if (recent.length || tm < DAY_START || tm >= NIGHT_START) return;
  await log.try(A, "Sayım yapılamadı", async () => {
    const balances = must(await admin.from("v_stock_lot").select("product_id, lot_no, qty").eq("warehouse_id", RAW_WH.id).neq("qty", 0), "bakiyeler");
    if (!balances.length) return;
    const count = must(await warehouse.from("stock_counts").insert({ no: "", warehouse_id: RAW_WH.id, count_date: today, scope: "Tüm ürünler", note: "Haftalık hammadde sayımı (sim)" }).select("id, no").single(), "sayım");
    must(await warehouse.from("stock_count_lines").insert(balances.map((b) => ({ count_id: count.id, product_id: b.product_id, lot_no: b.lot_no, system_qty: b.qty }))), "sayım satırları");
    const lines = must(await warehouse.from("stock_count_lines").select("id, system_qty").eq("count_id", count.id), "sayım satırları");
    const userId = (await warehouse.auth.getUser()).data.user?.id;
    for (const l of lines) {
      const counted = chance(0.3) ? round(Number(l.system_qty) * rnd(0.995, 1.003), 1) : Number(l.system_qty);
      must(await warehouse.from("stock_count_lines").update({ counted_qty: counted, counted_by: userId, counted_at: new Date().toISOString() }).eq("id", l.id), "sayılan miktar");
    }
    must(await warehouse.rpc("complete_stock_count", { p_id: count.id }), "sayım tamamla");
    log.ok(A, `Sayım ${count.no} tamamlandı (${lines.length} kalem)`);
  });
}

// ── Tur ──
process.stdout.write(`Simülasyon turu ${now.toISOString()} (aralık ${HOURS} sa)\n`);
for (const [name, fn] of [
  ["Satış", sales],
  ["Planlama", planning],
  ["Satın alma", purchasing],
  ["Depo", receiving],
  ["Üretim", production],
  ["Kalite", qualityControl],
  ["Depo", shipping],
  ["Depo", stockCount],
]) {
  await log.try(name, "Beklenmeyen hata", fn);
}

const failed = log.events.filter((e) => !e.ok);
process.stdout.write(`\nÖzet: ${log.events.length - failed.length} işlem başarılı, ${failed.length} hata.\n`);
// --strict: herhangi bir bölüm hata aldıysa çıkış kodu 1 (CI'da canlıya geçişi durdurur)
if (process.argv.includes("--strict") && failed.length) process.exitCode = 1;
if (env.GITHUB_STEP_SUMMARY) {
  const rows = log.events.map((e) => `| ${e.ok ? "✅" : "❌"} | ${e.agent} | ${e.text.replaceAll("|", "/")} |`).join("\n");
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## Simülasyon turu ${today}\n\n${log.events.length - failed.length} başarılı, ${failed.length} hata\n\n| | Bölüm | İşlem |\n|---|---|---|\n${rows}\n`);
}
