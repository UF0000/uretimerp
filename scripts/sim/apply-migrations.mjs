// Test (simülasyon) veritabanına henüz uygulanmamış migration'ları sırayla uygular.
// Supabase CLI ile aynı kayıt tablosunu kullanır; sonradan `supabase db push` kaldığı yerden devam eder.
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";
import { loadEnv, requireEnv, pgSsl } from "./env.mjs";

const env = loadEnv();
requireEnv(env, ["SIM_SUPABASE_DB_URL"]);
const client = new pg.Client({ connectionString: env.SIM_SUPABASE_DB_URL, ssl: pgSsl });
await client.connect();

await client.query(`
  CREATE SCHEMA IF NOT EXISTS supabase_migrations;
  CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text);
`);
const done = new Set((await client.query("SELECT version FROM supabase_migrations.schema_migrations")).rows.map((r) => r.version));

const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
let applied = 0;
for (const file of files) {
  const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
  if (done.has(version)) continue;
  const sql = readFileSync(`${dir}/${file}`, "utf8");
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO supabase_migrations.schema_migrations (version, statements, name) VALUES ($1, $2, $3)", [version, [sql], rest.join("_")]);
    await client.query("COMMIT");
    applied++;
    process.stdout.write(`✓ ${file}\n`);
  } catch (error) {
    await client.query("ROLLBACK");
    process.stdout.write(`✗ ${file}: ${error.message}\n`);
    process.exitCode = 1;
    break;
  }
}
process.stdout.write(`Uygulanan: ${applied}, toplam: ${files.length}\n`);
await client.end();
