// Simülasyon ortak yardımcıları: rol oturumları, rastgelelik, Türkiye saati, kayıt (log).
import { createClient } from "@supabase/supabase-js";
import { loadEnv, requireEnv } from "./env.mjs";

export const env = loadEnv();
requireEnv(env, ["SIM_SUPABASE_URL", "SIM_SUPABASE_ANON_KEY"]);

/** Rol hesabıyla oturum açmış istemci (RLS ve yetki kuralları gerçek kullanıcı gibi uygulanır) */
export async function signIn(key) {
  requireEnv(env, [`SIM_${key}_EMAIL`, `SIM_${key}_PASSWORD`]);
  const client = createClient(env.SIM_SUPABASE_URL, env.SIM_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: env[`SIM_${key}_EMAIL`], password: env[`SIM_${key}_PASSWORD`] });
  if (error) throw new Error(`${key} oturumu açılamadı: ${error.message}`);
  return client;
}

/** Supabase yanıtı: hata varsa fırlatır */
export const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
};

// ── Rastgelelik ──
export const rnd = (a, b) => a + Math.random() * (b - a);
export const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

// ── Türkiye saati (UTC+3, yaz saati yok) ──
const TR_OFFSET_MS = 3 * 3600000;
export const trDate = (d) => new Date(d.getTime() + TR_OFFSET_MS).toISOString().slice(0, 10);
export const trMinutes = (d) => {
  const t = new Date(d.getTime() + TR_OFFSET_MS);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
};
export const trWeekday = (d) => new Date(d.getTime() + TR_OFFSET_MS).getUTCDay();
export const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
export const hhmmToMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
export const stamp = (d) => trDate(d).replaceAll("-", "").slice(2);

/** Belgeler için sıradaki numara: PREFIX-YYYY-0001 */
export async function nextNo(client, table, prefix, year) {
  const rows = must(await client.from(table).select("no").like("no", `${prefix}-${year}-%`), `${table} numaraları`);
  const max = rows.reduce((m, r) => Math.max(m, Number(r.no.split("-").pop()) || 0), 0);
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}

// ── Kayıt: her ajanın yaptığı iş ve aldığı hatalar ──
export function createLog() {
  const events = [];
  const add = (agent, ok, text) => {
    events.push({ agent, ok, text });
    process.stdout.write(`${ok ? "✓" : "✗"} [${agent}] ${text}\n`);
  };
  return {
    events,
    ok: (agent, text) => add(agent, true, text),
    fail: (agent, text, error) => add(agent, false, `${text}: ${error instanceof Error ? error.message : String(error)}`),
    /** Bir işi dener; hata olursa kaydeder ve devam eder (bir ajanın hatası diğerlerini durdurmaz) */
    async try(agent, text, fn) {
      try {
        return await fn();
      } catch (error) {
        add(agent, false, `${text}: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
      }
    },
  };
}
