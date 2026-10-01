// Test (simülasyon) veritabanını sıfırlar ve canlıdan YALNIZCA ana veriyi kopyalar.
// Canlıya yalnızca okuma yapılır. Hareket/iş emri/sipariş gibi işlem verisi boş başlar.
// Kullanım: node scripts/sim/copy-master-data.mjs
import pg from "pg";
import { loadEnv, requireEnv, pgSsl } from "./env.mjs";

const env = loadEnv();
requireEnv(env, ["SUPABASE_DB_URL", "SIM_SUPABASE_DB_URL"]);
if (env.SUPABASE_DB_URL === env.SIM_SUPABASE_DB_URL) throw new Error("Canlı ve test veritabanı aynı olamaz.");

// Bağımlılık sırasına göre (önce referans verilenler)
const MASTER_TABLES = [
  "product_groups",
  "warehouses",
  "partners",
  "production_lines",
  "products",
  "molds",
  "operators",
  "reason_codes",
  "line_capacities",
  "reference_capacities",
  "calendar_holidays",
  "cost_parameters",
  "boms",
  "bom_extrusion",
  "bom_injection",
  "bom_items",
  "bom_parameters",
  "product_suppliers",
  "supplier_prices",
];

const live = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: pgSsl });
const test = new pg.Client({ connectionString: env.SIM_SUPABASE_DB_URL, ssl: pgSsl });
await live.connect();
await test.connect();

// Yazılabilir kolonlar (üretilen kolonlar hariç)
const columnsOf = async (table) =>
  (
    await test.query(
      `SELECT a.attname FROM pg_attribute a
       WHERE a.attrelid = ('public.' || quote_ident($1))::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
       ORDER BY a.attnum`,
      [table],
    )
  ).rows.map((r) => r.attname);

try {
  await test.query("BEGIN");
  // Tetikleyiciler ve FK denetimi bu oturumda kapalı (append-only defter, denetim kaydı, otomatik doldurma)
  await test.query("SET LOCAL session_replication_role = replica");

  const all = (await test.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'profiles'`)).rows.map((r) => r.tablename);
  await test.query(`TRUNCATE ${all.map((t) => `public."${t}"`).join(", ")} CASCADE`);

  for (const table of MASTER_TABLES) {
    const cols = await columnsOf(table);
    const list = cols.map((c) => `"${c}"`).join(", ");
    const rows = (await live.query(`SELECT ${list} FROM public."${table}"`)).rows;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      await test.query(`INSERT INTO public."${table}" (${list}) SELECT ${list} FROM json_populate_recordset(NULL::public."${table}", $1::json)`, [JSON.stringify(chunk)]);
    }
    process.stdout.write(`${table}: ${rows.length}\n`);
  }
  await test.query("COMMIT");
  process.stdout.write("Ana veri kopyalandı.\n");
} catch (error) {
  await test.query("ROLLBACK");
  process.stdout.write("Hata: " + error.message + "\n");
  process.exitCode = 1;
} finally {
  await live.end();
  await test.end();
}
