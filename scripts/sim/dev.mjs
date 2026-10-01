// Uygulamayı simülasyon (test) veritabanına bağlı açar: npm run dev:sim → http://localhost:3001
// Giriş: sim-admin@example.com (şifre .env.local'da SIM_ADMIN_PASSWORD). Normal `npm run dev` ile aynı anda çalıştırmayın.
import { spawn } from "node:child_process";
import { loadEnv, requireEnv } from "./env.mjs";

const env = loadEnv();
requireEnv(env, ["SIM_SUPABASE_URL", "SIM_SUPABASE_ANON_KEY"]);
const child = spawn("npx", ["next", "dev", "-p", "3001"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: env.SIM_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: env.SIM_SUPABASE_ANON_KEY },
});
child.on("exit", (code) => process.exit(code ?? 0));
