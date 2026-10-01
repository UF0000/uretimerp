// Test (simülasyon) veritabanında rol hesaplarını açar / günceller ve aktif eder.
// Şifreler rastgele üretilir, .env.local'a SIM_<ROL>_EMAIL / SIM_<ROL>_PASSWORD olarak yazılır (ekrana basılmaz).
// Kullanım: node scripts/sim/setup-users.mjs
import { appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, requireEnv, pgSsl } from "./env.mjs";

const env = loadEnv();
requireEnv(env, ["SIM_SUPABASE_URL", "SIM_SUPABASE_SERVICE_ROLE_KEY", "SIM_SUPABASE_DB_URL"]);

const USERS = [
  { key: "ADMIN", role: "admin", name: "Sim Yönetici" },
  { key: "OPERATOR", role: "operator", name: "Sim Operatör" },
  { key: "WAREHOUSE", role: "warehouse", name: "Sim Depocu" },
  { key: "QUALITY", role: "quality", name: "Sim Kalite" },
];

const admin = createClient(env.SIM_SUPABASE_URL, env.SIM_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: env.SIM_SUPABASE_DB_URL, ssl: pgSsl });
await db.connect();

const existing = (await admin.auth.admin.listUsers({ perPage: 1000 })).data?.users ?? [];
const lines = [];
for (const u of USERS) {
  const email = `sim-${u.role}@example.com`;
  const password = env[`SIM_${u.key}_PASSWORD`] || randomBytes(18).toString("base64url");
  const found = existing.find((x) => x.email === email);
  const res = found
    ? await admin.auth.admin.updateUserById(found.id, { password, email_confirm: true })
    : await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: u.name } });
  if (res.error) throw new Error(`${email}: ${res.error.message}`);
  await db.query("UPDATE public.profiles SET role = $2, active = true, name = $3 WHERE id = $1", [res.data.user.id, u.role, u.name]);
  if (!env[`SIM_${u.key}_EMAIL`]) lines.push(`SIM_${u.key}_EMAIL=${email}`, `SIM_${u.key}_PASSWORD=${password}`);
  process.stdout.write(`✓ ${email} (${u.role})\n`);
}
if (lines.length) appendFileSync(".env.local", `\n# Simülasyon rol hesapları (test veritabanı)\n${lines.join("\n")}\n`);
await db.end();
