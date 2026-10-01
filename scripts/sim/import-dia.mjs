// DIA 2026 üretim verisini (boru + fitting "İş Emirleri") TEST veritabanına yükler.
// Rol hesaplarıyla, sistemin kendi işlemleriyle: eksik ürün/kalıp/neden kodu/reçete (yönetici),
// açılış hammadde stoğu (satın alma + mal kabul), iş emri + vardiya girişleri (operatör).
//  - Fire/duruş iş emri bazında nedensiz → yalnız TEST'te açılan "DIA aktarımı — neden kaydı yok" kodları
//    (DIA'daki "Nedeni Bilinmeyen" kodları kullanıcı kararıyla sisteme alınmaz)
//  - Kalıp: ürüne bağlı, yoksa aynı genel koddaki kalıp (uygulamadaki saveBom kuralı)
//  - Uzun iş emri brüt süreyi koruyarak ≤ 12 saatlik ardışık girişlere bölünür (miktarlar orantılı)
//  - Reçete değerleri DIA'dan: kg/m = sağlam/metre, hedef hız = hat hızı, parça g = sağlam/adet,
//    çevrim = standart çevrim (parça başı) × göz, yolluk = DIA yolluğu / atış
// Tekrar çalıştırmak güvenli: var olan üretim emri numaraları atlanır.
// Kullanım: node scripts/sim/import-dia.mjs <boru.xlsx> <fitting.xlsx>
import { signIn, must, createLog, round, trDate } from "./lib.mjs";
import { readDiaWorkOrders } from "./dia-data.mjs";

const [pipeFile = "sifonik-boru-20261001-131817.xlsx", fittingFile = "sifonik-fittings-20261001-132209.xlsx"] = process.argv.slice(2);
const W = readDiaWorkOrders(pipeFile, fittingFile).sort((a, b) => a.start - b.start);
const log = createLog();
const [admin, operator, warehouse] = await Promise.all(["ADMIN", "OPERATOR", "WAREHOUSE"].map(signIn));
const A = "DIA aktarım";

const LINE = { "PPR EXTRUDER": "PP", "PE EXTRUDER": "PE", "UN 160": "ENJ160", "UN 260": "ENJ 260", "UN 480": "ENJ 480" };
const RAW = { "PP (Polipropilen)": "PP.000.N.003.27", "PE (Polietilen)": "PE.080.BK.001.27" };
const SCRAP = { "PP (Polipropilen)": "FİRE.PP.01", "PE (Polietilen)": "FİRE.PE.01" };
const MAX_CHUNK_MIN = 720;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// ── 1. Neden kodları ──
const reasons = must(await admin.from("reason_codes").select("id, kind, code, label"), "neden kodları");
async function reason(kind, code, label) {
  const found = reasons.find((r) => r.kind === kind && r.label.toLocaleLowerCase("tr") === label.toLocaleLowerCase("tr"));
  if (found) return found.id;
  const row = must(await admin.from("reason_codes").insert({ kind, code, label, active: true }).select("id, kind, code, label").single(), `neden ${label}`);
  reasons.push(row);
  log.ok(A, `Neden kodu açıldı: ${code} ${label}`);
  return row.id;
}
const SCRAP_REASON = await reason("scrap", "AKT-F", "DIA aktarımı — fire nedeni kaydı yok");
const DOWN_REASON = await reason("downtime", "AKT-D", "DIA aktarımı — duruş nedeni kaydı yok");

// ── 2. Ürünler (eksikler DIA adıyla açılır) ──
const codes = [...new Set(W.map((w) => w.productCode))];
const products = new Map(must(await admin.from("products").select("id, code, name, unit, variant_code").in("code", codes), "ürünler").map((p) => [p.code, p]));
for (const w of W) {
  if (products.has(w.productCode)) continue;
  const row = must(
    await admin.from("products").insert({ code: w.productCode, name: w.productName, type: "finished", unit: w.type === "extrusion" ? "metre" : "adet", active: true, description: "DIA üretim raporundan (test aktarımı)" }).select("id, code, name, unit, variant_code").single(),
    `ürün ${w.productCode}`,
  );
  products.set(row.code, row);
  log.ok(A, `Ürün kartı açıldı: ${row.code} ${row.name}`);
}
const rawAndScrap = new Map(must(await admin.from("products").select("id, code").in("code", [...Object.values(RAW), ...Object.values(SCRAP)]), "hammadde/fire").map((p) => [p.code, p.id]));
const lines = new Map(must(await admin.from("production_lines").select("id, code"), "hatlar").map((l) => [l.code, l.id]));

// ── 3. Kalıplar (fitting): ürüne bağlı, yoksa aynı genel koddaki aktif kalıp; hiç yoksa DIA değerleriyle açılır ──
const molds = must(await admin.from("molds").select("id, code, product_id, status, cavity_count, cycle_time_sec, sprue_weight_g, operation_mode, product:products(code, variant_code)").eq("status", "active").order("code"), "kalıplar");
const moldOf = new Map();
const modeMismatch = [];
for (const code of [...new Set(W.filter((w) => w.type === "injection").map((w) => w.productCode))]) {
  const p = products.get(code);
  const rows = W.filter((w) => w.productCode === code);
  const mode = rows[0].moldType === "Semi" ? "yari_otomatik" : "otomatik";
  let m = molds.find((x) => x.product_id === p.id) ?? molds.find((x) => p.variant_code && x.product?.variant_code === p.variant_code);
  if (!m) {
    const std = median(rows.map((w) => w.stdCycleSecPerPart).filter(Boolean));
    m = must(
      await admin.from("molds").insert({ code: `KLP-${p.variant_code || code}`, name: `Kalıp - ${p.name}`, product_id: p.id, cavity_count: 1, cycle_time_sec: std, product_weight_g: round(median(rows.map((w) => (w.goodKg / w.produced) * 1000)), 3), status: "active", operation_mode: mode }).select("id, code, product_id, cavity_count, cycle_time_sec, sprue_weight_g, operation_mode").single(),
      `kalıp ${code}`,
    );
    molds.push(m);
    log.ok(A, `Kalıp kartı açıldı: ${m.code} (${mode === "otomatik" ? "otomatik" : "yarı otomatik"})`);
  } else if (m.operation_mode !== mode) {
    modeMismatch.push(`${m.code}: kart ${m.operation_mode ?? "boş"} → DIA ${mode}`);
    must(await admin.from("molds").update({ operation_mode: mode }).eq("id", m.id), "kalıp çalışma tipi");
    m.operation_mode = mode;
  }
  moldOf.set(code, m);
}
if (modeMismatch.length) log.ok(A, `Kalıp çalışma tipi DIA'ya göre düzeltildi (${modeMismatch.length}): ${modeMismatch.join("; ")}`);

// ── 4. Reçeteler: DIA değerleriyle (varsa yeni versiyon) ──
const activeBoms = must(await admin.from("boms").select("id, product_id, code").eq("active", true).in("product_id", [...products.values()].map((p) => p.id)), "reçeteler");
const bomOf = new Map();
for (const code of codes) {
  const p = products.get(code);
  const rows = W.filter((w) => w.productCode === code);
  const w0 = rows[0];
  const bom = {
    id: activeBoms.find((b) => b.product_id === p.id)?.id ?? null,
    product_id: p.id,
    production_type: w0.type,
    name: p.name,
    active: true,
    regrind_pct: "0",
    notes: "DIA 2026 üretim verisinden (test aktarımı)",
    items: [{ component_product_id: rawAndScrap.get(RAW[w0.material]), quantity: 0, unit: "kg", ratio_pct: 100 }],
  };
  if (w0.type === "extrusion") {
    const kgPerMeter = round(median(rows.map((w) => w.goodKg / w.produced)), 4);
    const speeds = rows.map((w) => w.lineSpeedMPerMin).filter((v) => v > 0);
    bom.extrusion = { line_id: lines.get(LINE[w0.machine]), kg_per_meter: kgPerMeter, scrap_pct: 3, scrap_product_id: rawAndScrap.get(SCRAP[w0.material]), target_m_per_hour: speeds.length ? round(median(speeds) * 60, 2) : null };
  } else {
    const m = moldOf.get(code);
    const cavity = Math.max(1, Number(m.cavity_count) || 1);
    const shots = rows.reduce((s, w) => s + w.produced / cavity, 0);
    bom.injection = {
      mold_id: m.id,
      cavity_count: cavity,
      cycle_time_sec: round(median(rows.map((w) => w.stdCycleSecPerPart)) * cavity, 3),
      product_weight_g: round(median(rows.map((w) => (w.goodKg / w.produced) * 1000)), 3),
      runner_sprue_weight_g: shots > 0 ? round((rows.reduce((s, w) => s + w.runnerKg, 0) * 1000) / shots, 4) : 0,
      scrap_product_id: rawAndScrap.get(SCRAP[w0.material]),
    };
  }
  const res = must(await admin.rpc("save_bom", { p_bom: bom }), `${code} reçete`);
  bomOf.set(code, { id: res.id, line: lines.get(LINE[w0.machine]), mold: bom.injection?.mold_id ?? null, scrapProduct: rawAndScrap.get(SCRAP[w0.material]) });
}
log.ok(A, `${bomOf.size} ürünün reçetesi DIA değerleriyle kaydedildi`);

// ── 5. Yüklenmemiş iş emirleri ──
const existing = new Set(must(await admin.from("work_orders").select("no").in("no", W.map((w) => w.no)), "var olan iş emirleri").map((w) => w.no));
const todo = W.filter((w) => !existing.has(w.no));
log.ok(A, `${W.length} iş emrinden ${todo.length} tanesi yüklenecek (${existing.size} zaten var)`);

// ── 6. Açılış hammadde stoğu: tüketim kadar satın alma + mal kabul ──
const needByRaw = new Map();
for (const w of todo) needByRaw.set(RAW[w.material], (needByRaw.get(RAW[w.material]) ?? 0) + w.usedKg);
if (needByRaw.size) {
  const supplier = must(await admin.from("partners").select("id").eq("type", "supplier").limit(1).single(), "tedarikçi");
  const po = must(await admin.from("purchase_orders").insert({ no: "", partner_id: supplier.id, order_date: "2026-01-01", expected_date: "2026-01-01", currency: "TRY", note: "DIA aktarımı: açılış hammadde stoğu" }).select("id, no").single(), "açılış siparişi");
  must(await admin.from("purchase_order_items").insert([...needByRaw].map(([code, kg]) => ({ purchase_order_id: po.id, product_id: rawAndScrap.get(code), quantity: Math.ceil(kg) }))), "açılış kalemleri");
  must(await admin.from("purchase_orders").update({ status: "ordered", ordered_at: new Date().toISOString() }).eq("id", po.id), "sipariş verildi");
  const items = must(await admin.from("v_purchase_order_items").select("id, remaining_qty").eq("purchase_order_id", po.id), "kalemler");
  must(await warehouse.rpc("receive_purchase_order", { p_po_id: po.id, p_warehouse_id: (await admin.from("warehouses").select("id").eq("type", "raw").order("name").limit(1).single()).data.id, p_date: "2026-01-01", p_lines: items.map((i) => ({ item_id: i.id, qty: Number(i.remaining_qty), lot_no: "DIA-ACILIS" })), p_note: "DIA aktarımı" }), "açılış teslim");
  log.ok(A, `Açılış stoğu ${po.no}: ${[...needByRaw].map(([c, kg]) => `${c} ${Math.ceil(kg)} kg`).join(", ")}`);
}
const finishedWh = (await admin.from("warehouses").select("id").eq("name", "Mamül").maybeSingle()).data?.id ?? (await admin.from("warehouses").select("id").eq("type", "finished").limit(1).single()).data.id;

// ── 7. İş emri + girişler (operatör) ──
let entryCount = 0;
for (const w of todo) {
  await log.try(A, `${w.no} yüklenemedi`, async () => {
    const b = bomOf.get(w.productCode);
    const p = products.get(w.productCode);
    const wo = must(await operator.from("work_orders").insert({ no: w.no, product_id: p.id, bom_id: b.id, planned_qty: w.produced, line_id: b.line, mold_id: b.mold, status: "in_progress", started_at: w.start.toISOString() }).select("id").single(), "iş emri");
    // Brüt süre ≤ 12 sa'lik parçalara; miktarlar süreye orantılı, son parça kalanı alır
    const n = Math.max(1, Math.ceil(w.grossMin / MAX_CHUNK_MIN));
    const isPcs = w.type === "injection";
    let t = w.start.getTime();
    const left = { produced: w.produced, used: w.usedKg, scrap: w.scrapKg, down: w.downtimeMin, gross: w.grossMin };
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      const dur = last ? left.gross : MAX_CHUNK_MIN;
      const share = dur / w.grossMin;
      const produced = last ? left.produced : isPcs ? Math.round(w.produced * share) : round(w.produced * share, 3);
      const scrap = last ? round(left.scrap, 3) : round(w.scrapKg * share, 3);
      const used = last ? round(left.used, 3) : round(w.usedKg * share, 3);
      const down = last ? round(left.down, 2) : round(w.downtimeMin * share, 2);
      left.produced -= produced;
      left.used -= used;
      left.scrap -= scrap;
      left.down -= down;
      left.gross -= dur;
      const startAt = new Date(t);
      const endAt = new Date(t + dur * 60000);
      t = endAt.getTime();
      must(
        await operator.rpc("save_production_entry", {
          p: {
            work_order_id: wo.id,
            replaces_entry_id: null,
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            operator_id: null,
            produced_qty: produced,
            total_used_kg: used,
            scraps: scrap > 0 ? [{ reason_code_id: SCRAP_REASON, kg: scrap }] : [],
            downtimes: down > 0 ? [{ reason_code_id: DOWN_REASON, minutes: down }] : [],
            scrap_product_id: scrap > 0 ? b.scrapProduct : null,
            target_warehouse_id: produced > 0 ? finishedWh : null,
            close_work_order: last,
            raw_lots: {},
          },
        }),
        `giriş ${i + 1}/${n}`,
      );
      entryCount++;
    }
    log.ok(A, `${w.no} ${w.productCode} ${trDate(w.start)}: ${w.produced} ${isPcs ? "adet" : "m"}, ${n} giriş`);
  });
}

const failed = log.events.filter((e) => !e.ok).length;
process.stdout.write(`\nAktarım bitti: ${todo.length} iş emri, ${entryCount} giriş, ${failed} hata.\n`);
