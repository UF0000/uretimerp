"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { readAll } from "@/lib/supabase/read-all";
import { formatDate, formatTR } from "@/lib/format";
import type { AppNotification } from "@/lib/notifications";
import { hasPermission } from "@/lib/permissions";

/** Stok uyarısında sayılmayan depolar (ürün kartındaki "kullanılabilir stok" ile aynı) */
const UNUSABLE_WAREHOUSES = new Set(["quarantine", "scrap", "regrind"]);

/**
 * Anlık uyarılar (saklanmaz, her seferinde hesaplanır):
 * kritik / minimum altı stok, bakımı gelen kalıp, açık NCR, teslim tarihi geçen sipariş.
 */
export async function getNotifications(): Promise<AppNotification[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });

  const [products, stock, warehouses, molds, ncrs, orders] = await Promise.all([
    readAll(
      (from, to) =>
        supabase.from("products").select("id, code, name, unit, min_stock, critical_stock").eq("active", true).or("min_stock.gt.0,critical_stock.gt.0").order("id").range(from, to),
      "Ürünler okunamadı",
    ),
    readAll((from, to) => supabase.from("v_stock").select("product_id, warehouse_id, qty").range(from, to), "Stok okunamadı"),
    supabase.from("warehouses").select("id, type"),
    supabase.from("v_mold_maintenance").select("mold_id, code, name, shots_since, interval_shots, used_pct, state").in("state", ["yaklasiyor", "gecikti"]),
    supabase.from("ncr").select("id, no, description, created_at, product:products(code)").eq("status", "open").order("created_at"),
    supabase.from("orders").select("id, no, delivery_date, partner:partners(name)").in("status", ["open", "in_production"]).lt("delivery_date", today).order("delivery_date"),
  ]);

  const items: AppNotification[] = [];

  // Stok: kullanılabilir depolardaki toplam
  const unusable = new Set((warehouses.data ?? []).filter((w) => UNUSABLE_WAREHOUSES.has(w.type)).map((w) => w.id));
  const usable = new Map<string, number>();
  for (const s of stock) {
    if (!s.product_id || (s.warehouse_id && unusable.has(s.warehouse_id))) continue;
    usable.set(s.product_id, (usable.get(s.product_id) ?? 0) + Number(s.qty ?? 0));
  }
  for (const p of products) {
    const qty = usable.get(p.id) ?? 0;
    const critical = Number(p.critical_stock) || 0;
    const min = Number(p.min_stock) || 0;
    const level = critical > 0 && qty <= critical ? "critical" : min > 0 && qty <= min ? "min" : null;
    if (!level) continue;
    items.push({
      key: `stok:${p.id}:${level}`,
      kind: "stok",
      severity: level === "critical" ? "danger" : "warning",
      title: `${p.code} ${level === "critical" ? "kritik seviyede" : "minimum altında"}`,
      detail: `${p.name} · stok ${formatTR(qty, 0)} ${p.unit} (${level === "critical" ? `kritik ${formatTR(critical, 0)}` : `min ${formatTR(min, 0)}`})`,
      href: "/depo",
    });
  }

  for (const m of molds.data ?? []) {
    const late = m.state === "gecikti";
    items.push({
      key: `kalip:${m.mold_id}:${m.state}`,
      kind: "kalip",
      severity: late ? "danger" : "warning",
      title: `${m.code} ${late ? "bakımı gecikti" : "bakımı yaklaşıyor"}`,
      detail: `${m.name ?? ""} · ${formatTR(Number(m.shots_since ?? 0), 0)} / ${formatTR(Number(m.interval_shots ?? 0), 0)} atış (%${formatTR(Number(m.used_pct ?? 0), 0)})`,
      href: "/ana-veri",
    });
  }

  for (const n of ncrs.data ?? []) {
    const product = Array.isArray(n.product) ? n.product[0] : n.product;
    items.push({
      key: `ncr:${n.id}`,
      kind: "ncr",
      severity: "warning",
      title: `NCR ${n.no} açık`,
      detail: `${product?.code ?? ""} · ${n.description}${n.created_at ? ` · ${formatDate(n.created_at)}` : ""}`,
      href: "/kalite",
    });
  }

  // Sipariş uyarısı yalnız siparişleri görebilen rollere (kalite rolü sipariş sayfasını açamaz)
  for (const o of hasPermission("order:read", user.role) ? (orders.data ?? []) : []) {
    const partner = Array.isArray(o.partner) ? o.partner[0] : o.partner;
    items.push({
      key: `siparis:${o.id}`,
      kind: "siparis",
      severity: "danger",
      title: `Sipariş ${o.no} teslim tarihi geçti`,
      detail: `${partner?.name ?? ""} · teslim ${o.delivery_date ? formatDate(o.delivery_date) : "—"}`,
      href: "/siparisler",
    });
  }

  return items;
}
