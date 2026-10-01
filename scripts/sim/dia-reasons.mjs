// TEST veritabanı: DIA aktarımındaki fire/duruş nedenlerini, raporların "Fire Nedenleri" ve
// "Duruş Nedenleri" sayfalarındaki toplamlara göre girişlere dağıtır (kullanıcı isteği: grafikler
// ve yüzdeler DIA ile aynı olsun; hangi iş emrine ne düştüğü önemli değil).
// Yöntem: neden toplamları girişlerin gerçek fire/duruş toplamına ölçeklenir, girişler karışık sırayla
// doldurulur (her girişte genelde 1–2 neden). Eşleşmeyen / "Nedeni Bilinmeyen" paylar test'e özel
// "DIA aktarımı — … kaydı yok" kodunda kalır. Girişlerin fire kg / duruş dk toplamları değişmez.
// Kullanım (import-dia.mjs'den sonra): node scripts/sim/dia-reasons.mjs <boru.xlsx> <fitting.xlsx>
import pg from "pg";
import XLSX from "xlsx";
import { loadEnv, requireEnv, pgSsl } from "./env.mjs";
import { readDiaWorkOrders } from "./dia-data.mjs";

const env = loadEnv();
requireEnv(env, ["SIM_SUPABASE_DB_URL"]);
const [pipeFile = "sifonik-boru-20261001-131817.xlsx", fittingFile = "sifonik-fittings-20261001-132209.xlsx"] = process.argv.slice(2);
const num = (s) => Number(String(s).replace(/,/g, ""));
const norm = (s) => s.toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s) => new Set(norm(s).split(" ").filter((t) => t.length > 2));

function sheetTotals(file, sheet) {
  return XLSX.utils
    .sheet_to_json(XLSX.readFile(file).Sheets[sheet], { header: 1, raw: false, defval: "" })
    .slice(4)
    .filter((r) => r[0] && r[0] !== "TOPLAM")
    .map((r) => ({ label: r[0], value: num(r[1]) }));
}

const db = new pg.Client({ connectionString: env.SIM_SUPABASE_DB_URL, ssl: pgSsl });
await db.connect();
const reasons = (await db.query("SELECT id, kind, code, label FROM reason_codes")).rows;
const placeholder = { scrap: reasons.find((r) => r.code === "AKT-F"), downtime: reasons.find((r) => r.code === "AKT-D") };
if (!placeholder.scrap || !placeholder.downtime) throw new Error("Önce import-dia.mjs çalıştırılmalı (AKT-F / AKT-D kodları yok).");

/** DIA neden adı → neden kodu: aynı ad, yoksa tüm kelimeleri içeren kod, yoksa test'e özel "kaydı yok" */
function reasonFor(kind, label) {
  if (/^nedeni (bilinmeyen|tespit edilemeyen)$/.test(norm(label))) return placeholder[kind];
  const same = reasons.filter((r) => r.kind === kind);
  const exact = same.find((r) => norm(r.label) === norm(label));
  if (exact) return exact;
  const want = tokens(label);
  const loose = same.find((r) => [...want].every((t) => tokens(r.label).has(t)));
  return loose ?? placeholder[kind];
}

const W = readDiaWorkOrders(pipeFile, fittingFile);
const entries = (
  await db.query(
    `SELECT e.id, e.scrap_qty::float AS scrap, e.downtime_min::float AS down, b.production_type AS type
       FROM production_entries e JOIN work_orders w ON w.id = e.work_order_id JOIN boms b ON b.id = w.bom_id
      WHERE e.cancelled_at IS NULL AND w.no = ANY($1)`,
    [W.map((w) => w.no)],
  )
).rows;

/** Neden toplamlarını girişlere doldurur: her neden kotası sırayla tüketilir */
function allocate(list, field, totals) {
  const sumEntries = list.reduce((s, e) => s + e[field], 0);
  const sumSheet = totals.reduce((s, t) => s + t.value, 0);
  const quotas = totals.map((t) => ({ ...t, left: (t.value / sumSheet) * sumEntries }));
  const shuffled = [...list].filter((e) => e[field] > 0).sort(() => Math.random() - 0.5);
  const out = new Map();
  let qi = 0;
  for (const e of shuffled) {
    let need = e[field];
    const parts = [];
    while (need > 1e-9 && qi < quotas.length) {
      const take = Math.min(need, quotas[qi].left);
      if (take > 1e-9) parts.push({ reason: quotas[qi].reason, value: take });
      need -= take;
      quotas[qi].left -= take;
      if (quotas[qi].left <= 1e-9) qi++;
    }
    if (need > 1e-9) parts.push({ reason: quotas[quotas.length - 1].reason, value: need }); // yuvarlama artığı
    // Aynı nedenleri birleştir, 3 haneye yuvarla; son parça yuvarlama farkını alır (giriş toplamı korunur)
    const merged = [...parts.reduce((m, p) => m.set(p.reason.id, { reason: p.reason, value: (m.get(p.reason.id)?.value ?? 0) + p.value }), new Map()).values()];
    let rounded = merged.map((p) => ({ ...p, value: Math.round(p.value * 1000) / 1000 }));
    const diff = Math.round((e[field] - rounded.reduce((s, p) => s + p.value, 0)) * 1000) / 1000;
    rounded[rounded.length - 1].value = Math.round((rounded[rounded.length - 1].value + diff) * 1000) / 1000;
    rounded = rounded.filter((p) => p.value > 0);
    out.set(e.id, rounded);
  }
  return out;
}

const plan = { scrap: new Map(), downtime: new Map() };
for (const [type, file] of [["extrusion", pipeFile], ["injection", fittingFile]]) {
  const list = entries.filter((e) => e.type === type);
  for (const [kind, sheet, field] of [["scrap", "Fire Nedenleri", "scrap"], ["downtime", "Duruş Nedenleri", "down"]]) {
    const totals = sheetTotals(file, sheet).map((t) => ({ ...t, reason: reasonFor(kind, t.label) }));
    for (const t of totals) if (t.reason === placeholder[kind] && !/^nedeni /i.test(t.label)) process.stdout.write(`Uyarı: "${t.label}" için neden kodu bulunamadı → ${placeholder[kind].label}\n`);
    for (const [id, parts] of allocate(list, field, totals)) plan[kind].set(id, parts);
  }
}

try {
  await db.query("BEGIN");
  // Kapanmış iş emirlerinin girişleri: koruma tetikleyicileri bu bakım işleminde kapalı (yalnız test)
  await db.query("SET LOCAL session_replication_role = replica");
  const ids = entries.map((e) => e.id);
  await db.query("DELETE FROM production_entry_scraps WHERE entry_id = ANY($1)", [ids]);
  await db.query("DELETE FROM production_entry_downtimes WHERE entry_id = ANY($1)", [ids]);
  for (const [kind, table, col, mainCol] of [["scrap", "production_entry_scraps", "kg", "scrap_reason_code_id"], ["downtime", "production_entry_downtimes", "minutes", "downtime_reason_code_id"]]) {
    const rows = [...plan[kind]].flatMap(([entryId, parts]) => parts.map((p) => ({ entry_id: entryId, reason_code_id: p.reason.id, [col]: p.value })));
    for (let i = 0; i < rows.length; i += 500) {
      await db.query(`INSERT INTO ${table} (entry_id, reason_code_id, ${col}) SELECT entry_id, reason_code_id, ${col} FROM json_populate_recordset(NULL::${table}, $1::json)`, [JSON.stringify(rows.slice(i, i + 500))]);
    }
    // Ana neden alanı: en büyük pay (eski tek alanlı raporlar için)
    for (const [entryId, parts] of plan[kind]) {
      const top = [...parts].sort((a, b) => b.value - a.value)[0];
      if (top) await db.query(`UPDATE production_entries SET ${mainCol} = $2 WHERE id = $1`, [entryId, top.reason.id]);
    }
  }
  await db.query("COMMIT");
} catch (error) {
  await db.query("ROLLBACK");
  throw error;
}

// Kontrol: tür × neden payları
const check = await db.query(
  `SELECT b.production_type t, 'fire' k, r.label, sum(s.kg) v FROM production_entry_scraps s JOIN production_entries e ON e.id = s.entry_id JOIN work_orders w ON w.id = e.work_order_id JOIN boms b ON b.id = w.bom_id JOIN reason_codes r ON r.id = s.reason_code_id WHERE w.no = ANY($1) GROUP BY 1, 2, 3
   UNION ALL
   SELECT b.production_type, 'duruş', r.label, sum(d.minutes) FROM production_entry_downtimes d JOIN production_entries e ON e.id = d.entry_id JOIN work_orders w ON w.id = e.work_order_id JOIN boms b ON b.id = w.bom_id JOIN reason_codes r ON r.id = d.reason_code_id WHERE w.no = ANY($1) GROUP BY 1, 2, 3
   ORDER BY 1, 2, 4 DESC`,
  [W.map((w) => w.no)],
);
const totalsBy = new Map();
for (const r of check.rows) totalsBy.set(`${r.t}|${r.k}`, (totalsBy.get(`${r.t}|${r.k}`) ?? 0) + Number(r.v));
for (const r of check.rows) process.stdout.write(`${r.t === "extrusion" ? "Boru" : "Fitting"} ${r.k}: ${r.label} ${Number(r.v).toFixed(3)} (%${((Number(r.v) / totalsBy.get(`${r.t}|${r.k}`)) * 100).toFixed(2)})\n`);
const perEntry = [...plan.scrap.values(), ...plan.downtime.values()].map((p) => p.length);
process.stdout.write(`Girişlere dağıtıldı: fire ${plan.scrap.size}, duruş ${plan.downtime.size} giriş · giriş başına ortalama ${(perEntry.reduce((a, b) => a + b, 0) / perEntry.length).toFixed(2)} neden\n`);
await db.end();
