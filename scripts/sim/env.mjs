// .env.local okuyucu (simülasyon betikleri için; değerler ekrana yazdırılmaz)
import { readFileSync } from "node:fs";

export function loadEnv(path = ".env.local") {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // GitHub Actions'ta .env.local yok; değerler secret'lardan gelir
  }
  // GitHub Actions: tüm SIM_ satırları tek secret'ta (SIM_ENV, satır satır ANAHTAR=değer)
  for (const line of (env.SIM_ENV ?? "").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  // Rol hesaplarının e-postaları sabit (setup-users.mjs)
  for (const role of ["ADMIN", "OPERATOR", "WAREHOUSE", "QUALITY"]) env[`SIM_${role}_EMAIL`] ??= `sim-${role.toLowerCase()}@example.com`;
  // Panelden kopyalanan adres /rest/v1/ ile gelebilir; yalnızca kök adres kullanılır
  if (env.SIM_SUPABASE_URL) env.SIM_SUPABASE_URL = new URL(env.SIM_SUPABASE_URL).origin;
  return env;
}

export function requireEnv(env, keys) {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length) throw new Error("Eksik ortam değişkeni: " + missing.join(", "));
}

export const pgSsl = { rejectUnauthorized: false };
