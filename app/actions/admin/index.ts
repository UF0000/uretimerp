"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { parametersSchema, ParametersFormValues, userRoleSchema } from "@/lib/validations/admin";
import type { UserRole } from "@/lib/permissions";

export async function getUsers() {
  await requirePermission("admin:all");
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, name, email, role, active").order("name");
  if (error) throw new Error("Kullanıcılar getirilirken hata oluştu: " + error.message);
  return data;
}

export type UserRow = Awaited<ReturnType<typeof getUsers>>[number];

/** Rol değiştirir. Son aktif yöneticinin rolü veritabanı tarafından korunur. */
export async function updateUserRole(userId: string, role: UserRole) {
  await requirePermission("admin:all");
  const parsed = userRoleSchema.safeParse(role);
  if (!parsed.success) throw new Error("Geçersiz rol.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update({ role: parsed.data }).eq("id", userId).select("id");
  if (error) throw new Error(error.message);
  if (!data.length) throw new Error("Kullanıcı bulunamadı veya yetkiniz yok.");
  revalidatePath("/yonetim");
}

/** Kullanıcıyı aktif/pasif yapar. Pasif kullanıcı uygulamaya giremez ve hiçbir veriyi göremez. */
export async function setUserActive(userId: string, active: boolean) {
  const me = await requirePermission("admin:all");
  if (me.id === userId && !active) throw new Error("Kendi hesabınızı pasife alamazsınız.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update({ active }).eq("id", userId).select("id");
  if (error) throw new Error(error.message);
  if (!data.length) throw new Error("Kullanıcı bulunamadı veya yetkiniz yok.");
  revalidatePath("/yonetim");
}

const DEFAULT_PARAMETERS: ParametersFormValues = {
  labor_per_unit: 0,
  energy_per_unit: 0,
  overhead_pct: 0,
  usd_rate: 1,
  eur_rate: 1,
  shift_minutes: 720,
  target_scrap_pct: 3,
  overweight_tolerance_pct: 2.5,
  target_oee_pct: 85,
};

export async function getParameters(): Promise<ParametersFormValues & { id: string | null }> {
  await requirePermission("admin:all");
  const supabase = await createClient();
  const { data, error } = await supabase.from("cost_parameters").select("*").limit(1).maybeSingle();
  if (error) throw new Error("Parametreler getirilirken hata oluştu: " + error.message);
  if (!data) return { id: null, ...DEFAULT_PARAMETERS };
  return {
    id: data.id,
    labor_per_unit: Number(data.labor_per_unit),
    energy_per_unit: Number(data.energy_per_unit),
    overhead_pct: Number(data.overhead_pct),
    usd_rate: Number(data.usd_rate ?? 1),
    eur_rate: Number(data.eur_rate ?? 1),
    shift_minutes: Number(data.shift_minutes),
    target_scrap_pct: Number(data.target_scrap_pct),
    overweight_tolerance_pct: Number(data.overweight_tolerance_pct),
    target_oee_pct: Number(data.target_oee_pct),
  };
}

export async function saveParameters(values: ParametersFormValues) {
  await requirePermission("admin:all");
  const parsed = parametersSchema.safeParse(values);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz parametre.");
  const supabase = await createClient();

  const { data: existing } = await supabase.from("cost_parameters").select("id").limit(1).maybeSingle();
  const { error } = existing
    ? await supabase.from("cost_parameters").update(parsed.data).eq("id", existing.id)
    : await supabase.from("cost_parameters").insert(parsed.data);
  if (error) throw new Error("Parametreler kaydedilemedi: " + error.message);

  revalidatePath("/yonetim");
  revalidatePath("/maliyet");
  revalidatePath("/uretim/oee");
  revalidatePath("/uretim/analiz");
}

/** Dışa aktarılan tablolar: sayfa adı → sorgu. Hepsi RLS altında, yönetici yetkisiyle okunur. */
const EXPORT_TABLES = [
  ["Ürünler", "products"],
  ["Depolar", "warehouses"],
  ["Cariler", "partners"],
  ["Hatlar", "production_lines"],
  ["Kalıplar", "molds"],
  ["Neden kodları", "reason_codes"],
  ["Reçeteler", "boms"],
  ["Reçete kalemleri", "bom_items"],
  ["Siparişler", "orders"],
  ["Sipariş kalemleri", "order_items"],
  ["İş emirleri", "work_orders"],
  ["Vardiya girişleri", "production_entries"],
  ["Lotlar", "lots"],
  ["Stok hareketleri", "stock_movements"],
  ["Stok fişleri", "stock_documents"],
  ["Kalite kontrol", "quality_checks"],
  ["NCR", "ncr"],
  ["Parametreler", "cost_parameters"],
] as const;

/**
 * Tüm ana tabloların satırları (Excel yedeği için). Büyük tablolar 1.000'lik
 * sayfalar hâlinde okunur; PostgREST satır sınırına takılmaz.
 */
export async function getExportData() {
  await requirePermission("admin:all");
  const supabase = await createClient();
  const sheets: { name: string; rows: Record<string, unknown>[] }[] = [];

  const readAll = async (name: string, page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) => {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await page(from, from + 999);
      if (error) throw new Error(`${name} dışa aktarılamadı: ${error.message}`);
      rows.push(...((data ?? []) as Record<string, unknown>[]));
      if ((data ?? []).length < 1000) break;
    }
    sheets.push({ name, rows });
  };

  for (const [name, table] of EXPORT_TABLES) {
    await readAll(name, (from, to) => supabase.from(table).select("*").range(from, to));
  }
  await readAll("Stok bakiyesi", (from, to) => supabase.from("v_stock").select("*").range(from, to));
  return { exportedAt: new Date().toISOString(), sheets };
}
