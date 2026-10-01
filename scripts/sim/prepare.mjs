// Simülasyon hazırlığı (bir kez; tekrar çalıştırmak güvenli): yönetici hesabıyla test veritabanında
// karantina deposu, müşteri/tedarikçi, hammadde fiyat-tedarikçi bilgisi ve katalog reçetelerini tamamlar.
// Kullanım: node scripts/sim/prepare.mjs
import { signIn, must, createLog, round, trDate } from "./lib.mjs";
import { RAWS, CUSTOMERS, PRODUCTS, QUARANTINE_WAREHOUSE } from "./catalog.mjs";

const log = createLog();
const admin = await signIn("ADMIN");
const A = "Hazırlık";

// Karantina deposu (NCR için)
const warehouses = must(await admin.from("warehouses").select("id, name, type"), "depolar");
if (!warehouses.some((w) => w.type === "quarantine")) {
  must(await admin.from("warehouses").insert({ name: QUARANTINE_WAREHOUSE, type: "quarantine" }), "karantina deposu");
  log.ok(A, "Karantina deposu açıldı");
}

// Cariler
const partners = must(await admin.from("partners").select("id, name, type"), "cariler");
const partnerId = async (name, type) => {
  const found = partners.find((p) => p.name === name);
  if (found) return found.id;
  const row = must(await admin.from("partners").insert({ name, type, phone: "0 (212) 000 00 00", address: "Simülasyon carisi", active: true }).select("id, name, type").single(), `cari ${name}`);
  partners.push(row);
  log.ok(A, `Cari açıldı: ${name}`);
  return row.id;
};
for (const name of CUSTOMERS) await partnerId(name, "customer");

// Ürünler (kod → kart)
const codes = [...RAWS.map((r) => r.code), ...PRODUCTS.map((p) => p.code), ...new Set(PRODUCTS.map((p) => p.scrap))];
const products = new Map(must(await admin.from("products").select("id, code, name, unit, diameter_mm, sdr, wall_thickness_mm").in("code", codes), "ürünler").map((p) => [p.code, p]));
const missing = codes.filter((c) => !products.has(c));
if (missing.length) throw new Error("Test veritabanında bulunamayan ürün kodları: " + missing.join(", "));

// Hammadde: fiyat, min stok, ana tedarikçi + güncel fiyat
const today = trDate(new Date());
for (const r of RAWS) {
  const p = products.get(r.code);
  must(await admin.from("products").update({ unit_cost: r.price, currency: "TRY", min_stock: r.minStock, critical_stock: round(r.minStock / 2, 0) }).eq("id", p.id), `${r.code} fiyat`);
  const supplierId = await partnerId(r.supplier, "supplier");
  const existing = must(await admin.from("product_suppliers").select("id").eq("product_id", p.id).eq("partner_id", supplierId).maybeSingle(), "tedarikçi bağı");
  if (!existing) {
    const link = must(await admin.from("product_suppliers").insert({ product_id: p.id, partner_id: supplierId, is_primary: true, lead_time_days: 2, min_order_qty: r.moq, note: "Simülasyon" }).select("id").single(), `${r.code} tedarikçi`);
    must(await admin.from("supplier_prices").insert({ product_supplier_id: link.id, price: r.price, currency: "TRY", valid_from: today, note: "Simülasyon" }), `${r.code} fiyat`);
    log.ok(A, `${r.code}: tedarikçi ${r.supplier}, ${r.price} ₺/kg`);
  }
}

// Reçeteler: katalog ürününün aktif reçetesi yoksa açılır
const lines = new Map(must(await admin.from("production_lines").select("id, code"), "hatlar").map((l) => [l.code, l.id]));
const molds = must(await admin.from("molds").select("id, product_id, cavity_count, cycle_time_sec, product_weight_g, sprue_weight_g, status"), "kalıplar");
const boms = must(await admin.from("boms").select("id, product_id, code").eq("active", true), "reçeteler");

for (const item of PRODUCTS) {
  const p = products.get(item.code);
  if (boms.some((b) => b.product_id === p.id)) continue;
  const bom = {
    product_id: p.id,
    production_type: item.type,
    name: p.name,
    active: true,
    regrind_pct: "0",
    notes: "Simülasyon reçetesi",
    items: item.raws.map(([code, pct]) => ({ component_product_id: products.get(code).id, quantity: 0, unit: "kg", ratio_pct: pct })),
  };
  if (item.type === "extrusion") {
    const d = Number(p.diameter_mm);
    const e = item.wall ?? (Number(p.wall_thickness_mm) || d / Number(p.sdr));
    if (!d || !e) throw new Error(`${item.code}: çap/et bilgisi yok`);
    const kgPerMeter = round((Math.PI * (d - e) * e * item.density) / 1000, 4);
    bom.extrusion = { line_id: lines.get(item.line), kg_per_meter: kgPerMeter, scrap_pct: 3, scrap_product_id: products.get(item.scrap).id, target_m_per_hour: round(item.kgPerHour / kgPerMeter, 0) };
  } else {
    const mold = molds.find((m) => m.product_id === p.id && m.status === "active");
    if (!mold) throw new Error(`${item.code}: aktif kalıp yok`);
    bom.injection = { mold_id: mold.id, cavity_count: mold.cavity_count, cycle_time_sec: mold.cycle_time_sec, runner_sprue_weight_g: mold.sprue_weight_g ?? 0, product_weight_g: mold.product_weight_g, scrap_product_id: products.get(item.scrap).id };
  }
  const res = must(await admin.rpc("save_bom", { p_bom: bom }), `${item.code} reçete`);
  log.ok(A, `Reçete ${res.code}: ${item.code} ${p.name}`);
}

const failed = log.events.filter((e) => !e.ok).length;
process.stdout.write(`Hazırlık bitti. ${log.events.length - failed} işlem, ${failed} hata.\n`);
