"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { readAll } from "@/lib/supabase/read-all";
import { one } from "@/lib/utils";
import { computeStandardCost } from "@/lib/product-cost";
import { variantBaseFromCode } from "@/lib/product-meta";
import { saveBom } from "@/app/actions/bom";

const num = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));

/** Son 12 ay (bu ay dahil), YYYY-MM */
const lastMonths = () => {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1));
    return d.toISOString().slice(0, 7);
  });
};

export async function getProductDetail(id: string) {
  await requirePermission("master-data:read");
  const supabase = await createClient();

  const { data: product, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Ürün getirilirken hata oluştu: " + error.message);
  if (!product) return null;

  const [bomsRes, groupRes, paramsRes, variantsRes, linesRes] = await Promise.all([
    supabase
      .from("boms")
      .select(
        "id, code, name, version, production_type, extrusion:bom_extrusion(line_id, kg_per_meter, target_m_per_hour), injection:bom_injection(mold_id, cavity_count, cycle_time_sec, runner_sprue_weight_g, product_weight_g, mold:molds(id, code, name, cavity_count, cycle_time_sec, sprue_weight_g, product_weight_g)), items:bom_items(quantity, ratio_pct, component:products!component_product_id(id, code, name, unit_cost, currency, material_grade))",
      )
      .eq("product_id", id)
      .eq("active", true)
      .order("version", { ascending: false }),
    product.group_code ? supabase.from("product_groups").select("name").eq("code", product.group_code).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("cost_parameters").select("*").limit(1).maybeSingle(),
    product.variant_code
      ? supabase.from("products").select("id, code, name, unit, image_url, active").eq("variant_code", product.variant_code).eq("active", true).order("code")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("production_lines").select("id, code, name"),
  ]);
  if (bomsRes.error) throw new Error("Reçete getirilirken hata oluştu: " + bomsRes.error.message);

  const variants = variantsRes.data ?? [];
  const scopeIds = variants.length ? variants.map((v) => v.id) : [id];

  // ── Stok (ürün + varyantlar) ──
  const stockRes = await supabase.from("v_stock").select("product_id, qty").in("product_id", scopeIds);
  const stockBy = new Map<string, number>();
  for (const s of stockRes.data ?? []) stockBy.set(s.product_id!, (stockBy.get(s.product_id!) ?? 0) + Number(s.qty ?? 0));

  // ── Son 12 ayın hareketleri (ters kayıtlar hariç) ──
  const months = lastMonths();
  const moves = await readAll(
    (f, t) =>
      supabase
        .from("stock_movements")
        .select("id, product_id, direction, source_type, quantity, created_at, reverses_id")
        .in("product_id", scopeIds)
        .gte("created_at", `${months[0]}-01`)
        .order("created_at")
        .range(f, t),
    "Stok hareketleri getirilirken hata oluştu",
  );
  const reversed = new Set(moves.map((m) => m.reverses_id).filter(Boolean));
  const effective = moves.filter((m) => !m.reverses_id && !reversed.has(m.id));
  const monthly = months.map((m) => ({ month: m, production: 0, sale: 0, purchase: 0, consumption: 0 }));
  // Grafik bu ürünün hareketleri; varyant toplamları (12 ay) ayrıca
  const perVariant = new Map<string, { production: number; sale: number }>();
  for (const mv of effective) {
    const q = Number(mv.quantity);
    const isProduction = mv.direction === "in" && mv.source_type === "production";
    const isSale = mv.direction === "out" && mv.source_type === "sale";
    const v = perVariant.get(mv.product_id) ?? { production: 0, sale: 0 };
    if (isProduction) v.production += q;
    if (isSale) v.sale += q;
    perVariant.set(mv.product_id, v);

    if (mv.product_id !== id) continue;
    const row = monthly.find((x) => x.month === mv.created_at?.slice(0, 7));
    if (!row) continue;
    if (isProduction) row.production += q;
    else if (isSale) row.sale += q;
    else if (mv.direction === "in" && mv.source_type === "purchase") row.purchase += q;
    else if (mv.direction === "out" && mv.source_type === "production") row.consumption += q;
  }

  // ── Reçete / kalıp teknik verisi ──
  const bom = (bomsRes.data ?? [])[0] ?? null;
  const ext = one(bom?.extrusion ?? null);
  const inj = one(bom?.injection ?? null);
  const mold = one(inj?.mold ?? null);
  const components = (bom?.items ?? [])
    .map((it) => {
      const c = one(it.component);
      return c
        ? { id: c.id, code: c.code, name: c.name, grade: c.material_grade, ratioPct: num(it.ratio_pct), quantity: Number(it.quantity), unitCost: num(c.unit_cost), currency: c.currency }
        : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const technical = bom
    ? {
        bomId: bom.id,
        bomLabel: `${bom.code} v${bom.version} · ${bom.name}`,
        productionType: bom.production_type,
        lineName: ext?.line_id ? (linesRes.data ?? []).find((l) => l.id === ext.line_id)?.name ?? null : null,
        kgPerMeter: num(ext?.kg_per_meter),
        targetMPerHour: num(ext?.target_m_per_hour),
        mold: mold ? { id: mold.id, code: mold.code, name: mold.name } : null,
        cavityCount: num(inj?.cavity_count) ?? num(mold?.cavity_count),
        cycleTimeSec: num(inj?.cycle_time_sec) ?? num(mold?.cycle_time_sec),
        runnerWeightG: num(inj?.runner_sprue_weight_g) ?? num(mold?.sprue_weight_g),
        productWeightG: num(inj?.product_weight_g) ?? num(mold?.product_weight_g),
      }
    : null;

  const p = paramsRes.data;
  const cost = computeStandardCost({
    unit: product.unit,
    productionType: technical?.productionType ?? null,
    kgPerMeter: technical?.kgPerMeter ?? null,
    productWeightG: technical?.productWeightG ?? null,
    runnerWeightG: technical?.runnerWeightG ?? null,
    cavityCount: technical?.cavityCount ?? null,
    components,
    params: {
      usdRate: Number(p?.usd_rate || 1),
      eurRate: Number(p?.eur_rate || 1),
      laborPerUnit: Number(p?.labor_per_unit || 0),
      energyPerUnit: Number(p?.energy_per_unit || 0),
      overheadPct: Number(p?.overhead_pct || 0),
    },
  });

  // ── PP kuralına göre önerilen varyantlar (henüz bu gruba bağlı olmayanlar) ──
  const base = product.variant_code ?? variantBaseFromCode(product.code);
  let suggestions: { id: string; code: string; name: string; variant_code: string | null }[] = [];
  if (base) {
    const { data } = await supabase
      .from("products")
      .select("id, code, name, variant_code")
      .eq("active", true)
      .ilike("code", `_${base}%`)
      .neq("id", id)
      .limit(30);
    suggestions = (data ?? []).filter((s) => variantBaseFromCode(s.code) === base && s.variant_code !== product.variant_code);
  }

  return {
    product: { ...product, diameter_mm: num(product.diameter_mm), sdr: num(product.sdr), wall_thickness_mm: num(product.wall_thickness_mm), unit_cost: num(product.unit_cost) },
    groupName: groupRes.data?.name ?? null,
    stock: stockBy.get(id) ?? 0,
    technical,
    components,
    cost,
    monthly,
    variantBase: base,
    variants: variants.map((v) => ({ ...v, stock: stockBy.get(v.id) ?? 0, production12m: perVariant.get(v.id)?.production ?? 0, sale12m: perVariant.get(v.id)?.sale ?? 0 })),
    suggestions,
  };
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductDetail>>>;

// ─────────────────────────────── Düzenleme ───────────────────────────────

const technicalSchema = z.object({
  kg_per_meter: z.number().positive("0'dan büyük olmalıdır").nullable().optional(),
  target_m_per_hour: z.number().positive("0'dan büyük olmalıdır").nullable().optional(),
  cavity_count: z.number().int("Tam sayı girin").min(1, "En az 1").nullable().optional(),
  cycle_time_sec: z.number().min(0.1, "En az 0,1 sn").nullable().optional(),
  runner_sprue_weight_g: z.number().min(0, "Negatif olamaz").nullable().optional(),
  product_weight_g: z.number().positive("0'dan büyük olmalıdır").nullable().optional(),
});
export type TechnicalValues = z.infer<typeof technicalSchema>;

/**
 * Ürün kartından teknik veri düzenleme: aktif reçete save_bom ile kaydedilir
 * (üretimde kullanılmışsa yeni versiyon açılır, geçmiş hesaplar bozulmaz);
 * enjeksiyonda bağlı kalıp kartı da aynı değerlerle güncellenir.
 */
export async function updateProductTechnical(productId: string, bomId: string, values: TechnicalValues) {
  await requirePermission("master-data:write");
  const parsed = technicalSchema.safeParse(values);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz değer.");
  const v = parsed.data;
  const supabase = await createClient();

  const { data: bom, error } = await supabase
    .from("boms")
    .select("*, extrusion:bom_extrusion(*), injection:bom_injection(*), items:bom_items(*), parameters:bom_parameters(*)")
    .eq("id", bomId)
    .eq("product_id", productId)
    .single();
  if (error) throw new Error("Reçete bulunamadı: " + error.message);
  const ext = one(bom.extrusion);
  const inj = one(bom.injection);

  const result = await saveBom({
    id: bom.id,
    product_id: bom.product_id,
    code: bom.code,
    name: bom.name,
    version: bom.version,
    active: bom.active,
    production_type: bom.production_type,
    regrind_pct: num(bom.regrind_pct),
    notes: bom.notes,
    items: (bom.items ?? []).map((i) => ({ component_product_id: i.component_product_id, quantity: Number(i.quantity), unit: i.unit, ratio_pct: num(i.ratio_pct) })),
    parameters: (bom.parameters ?? []).map((p) => ({ key: p.key, value: p.value })),
    extrusion:
      bom.production_type === "extrusion"
        ? {
            line_id: ext?.line_id ?? null,
            kg_per_meter: v.kg_per_meter ?? null,
            scrap_pct: num(ext?.scrap_pct),
            scrap_product_id: ext?.scrap_product_id ?? null,
            target_m_per_hour: v.target_m_per_hour ?? null,
          }
        : null,
    injection:
      bom.production_type === "injection"
        ? {
            mold_id: inj?.mold_id ?? null,
            cavity_count: v.cavity_count ?? null,
            cycle_time_sec: v.cycle_time_sec ?? null,
            runner_sprue_weight_g: v.runner_sprue_weight_g ?? null,
            product_weight_g: v.product_weight_g ?? null,
            scrap_product_id: inj?.scrap_product_id ?? null,
          }
        : null,
  });

  if (bom.production_type === "injection" && inj?.mold_id) {
    const moldUpdate: { cavity_count?: number; cycle_time_sec?: number; sprue_weight_g?: number | null; product_weight_g?: number | null } = {};
    if (v.cavity_count) moldUpdate.cavity_count = v.cavity_count;
    if (v.cycle_time_sec) moldUpdate.cycle_time_sec = v.cycle_time_sec;
    if (v.runner_sprue_weight_g !== undefined) moldUpdate.sprue_weight_g = v.runner_sprue_weight_g;
    if (v.product_weight_g !== undefined) moldUpdate.product_weight_g = v.product_weight_g;
    const { error: moldError } = await supabase.from("molds").update(moldUpdate).eq("id", inj.mold_id);
    if (moldError) throw new Error("Reçete kaydedildi ama kalıp güncellenemedi: " + moldError.message);
  }

  revalidatePath(`/ana-veri/urunler/${productId}`);
  revalidatePath("/ana-veri");
  return { newVersion: result.newVersion, version: result.version };
}

/** Görsel yüklendikten sonra adresini karta yazar (null = görseli kaldır). */
export async function setProductImage(productId: string, url: string | null) {
  await requirePermission("master-data:write");
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ image_url: url }).eq("id", productId);
  if (error) throw new Error(error.message);
  revalidatePath(`/ana-veri/urunler/${productId}`);
  revalidatePath("/ana-veri");
}

/** Ürünleri bir genel stok koduna (varyant grubuna) bağlar; code null ise gruptan çıkarır. */
export async function setVariantCode(productIds: string[], code: string | null) {
  await requirePermission("master-data:write");
  if (!productIds.length) return;
  const supabase = await createClient();
  const value = code?.trim() ? code.trim().toUpperCase() : null;
  const { error } = await supabase.from("products").update({ variant_code: value }).in("id", productIds);
  if (error) throw new Error(error.message);
  revalidatePath("/ana-veri");
  for (const pid of productIds) revalidatePath(`/ana-veri/urunler/${pid}`);
}

/** Varyant eklemek için ürün arama (kod veya ad). */
export async function searchProductsForVariant(q: string) {
  await requirePermission("master-data:read");
  const term = q.trim();
  if (term.length < 2) return [];
  const supabase = await createClient();
  const safe = term.replace(/[%,()]/g, " ");
  const { data, error } = await supabase
    .from("products")
    .select("id, code, name, variant_code")
    .eq("active", true)
    .or(`code.ilike.%${safe}%,name.ilike.%${safe}%`)
    .order("code")
    .limit(20);
  if (error) throw new Error(error.message);
  return data;
}
