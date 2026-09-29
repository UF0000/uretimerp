"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { one } from "@/lib/utils";

const DOC_BUCKET = "product-documents";
const refresh = (productId: string) => revalidatePath(`/ana-veri/urunler/${productId}`);

/** Teknik dokümanlar ve tedarikçiler (fiyat geçmişiyle). */
export async function getProductExtras(productId: string) {
  await requirePermission("master-data:read");
  const supabase = await createClient();
  const [docs, sups, partners] = await Promise.all([
    supabase.from("product_documents").select("id, category, title, file_name, mime_type, size_bytes, created_at").eq("product_id", productId).order("created_at", { ascending: false }),
    supabase
      .from("product_suppliers")
      .select("id, is_primary, supplier_code, lead_time_days, min_order_qty, note, partner:partners(id, name), prices:supplier_prices(id, price, currency, valid_from, note)")
      .eq("product_id", productId),
    supabase.from("partners").select("id, name").eq("type", "supplier").eq("active", true).order("name"),
  ]);
  if (docs.error) throw new Error("Dokümanlar getirilirken hata oluştu: " + docs.error.message);
  if (sups.error) throw new Error("Tedarikçiler getirilirken hata oluştu: " + sups.error.message);

  const suppliers = (sups.data ?? [])
    .map((s) => {
      const prices = [...(s.prices ?? [])]
        .map((p) => ({ id: p.id, price: Number(p.price), currency: p.currency, validFrom: p.valid_from, note: p.note }))
        .sort((a, b) => b.validFrom.localeCompare(a.validFrom));
      return {
        id: s.id,
        partnerId: one(s.partner)?.id ?? "",
        name: one(s.partner)?.name ?? "?",
        isPrimary: s.is_primary,
        supplierCode: s.supplier_code,
        leadTimeDays: s.lead_time_days,
        minOrderQty: s.min_order_qty === null ? null : Number(s.min_order_qty),
        note: s.note,
        prices,
        lastPrice: prices[0] ?? null,
      };
    })
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name, "tr"));

  return {
    documents: (docs.data ?? []).map((d) => ({ ...d, size_bytes: d.size_bytes === null ? null : Number(d.size_bytes) })),
    suppliers,
    supplierOptions: partners.data ?? [],
  };
}

export type ProductExtras = Awaited<ReturnType<typeof getProductExtras>>;

// ─────────────────────────────── Dokümanlar ───────────────────────────────

const docSchema = z.object({
  category: z.enum(["cizim", "belge", "foy", "test", "diger"]),
  title: z.string().trim().min(1, "Başlık zorunludur").max(160),
  file_path: z.string().min(1),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().max(120).nullable(),
  size_bytes: z.number().int().min(0).nullable(),
});

/** Dosya tarayıcıdan depoya yüklendikten sonra kaydı oluşturur. */
export async function addProductDocument(productId: string, values: z.infer<typeof docSchema>) {
  const me = await requirePermission("master-data:write");
  const parsed = docSchema.safeParse(values);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz doküman.");
  if (!parsed.data.file_path.startsWith(`${productId}/`)) throw new Error("Geçersiz dosya yolu.");
  const supabase = await createClient();
  const { error } = await supabase.from("product_documents").insert({ product_id: productId, uploaded_by: me.id, ...parsed.data });
  if (error) {
    await supabase.storage.from(DOC_BUCKET).remove([parsed.data.file_path]);
    throw new Error(error.message);
  }
  refresh(productId);
}

/** İndirme için 5 dakikalık imzalı bağlantı. */
export async function getDocumentUrl(documentId: string) {
  await requirePermission("master-data:read");
  const supabase = await createClient();
  const { data: doc, error } = await supabase.from("product_documents").select("file_path, file_name").eq("id", documentId).single();
  if (error) throw new Error("Doküman bulunamadı.");
  const { data, error: urlError } = await supabase.storage.from(DOC_BUCKET).createSignedUrl(doc.file_path, 300, { download: doc.file_name });
  if (urlError) throw new Error(urlError.message);
  return data.signedUrl;
}

export async function deleteProductDocument(documentId: string) {
  await requirePermission("master-data:write");
  const supabase = await createClient();
  const { data: doc, error } = await supabase.from("product_documents").select("product_id, file_path").eq("id", documentId).single();
  if (error) throw new Error("Doküman bulunamadı.");
  const { error: delError } = await supabase.from("product_documents").delete().eq("id", documentId);
  if (delError) throw new Error(delError.message);
  await supabase.storage.from(DOC_BUCKET).remove([doc.file_path]);
  refresh(doc.product_id);
}

// ─────────────────────────────── Tedarikçiler ───────────────────────────────

const supplierSchema = z.object({
  partnerId: z.string().uuid("Tedarikçi seçin"),
  isPrimary: z.boolean(),
  supplierCode: z.string().trim().max(60).nullable(),
  leadTimeDays: z.number().int("Tam sayı girin").min(0).nullable(),
  minOrderQty: z.number().min(0).nullable(),
  note: z.string().trim().max(300).nullable(),
});
export type SupplierValues = z.infer<typeof supplierSchema>;

export async function saveProductSupplier(productId: string, values: SupplierValues) {
  await requirePermission("master-data:write");
  const parsed = supplierSchema.safeParse(values);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz tedarikçi.");
  const v = parsed.data;
  const supabase = await createClient();
  if (v.isPrimary) {
    const { error } = await supabase.from("product_suppliers").update({ is_primary: false }).eq("product_id", productId);
    if (error) throw new Error(error.message);
  }
  const { error } = await supabase.from("product_suppliers").upsert(
    {
      product_id: productId,
      partner_id: v.partnerId,
      is_primary: v.isPrimary,
      supplier_code: v.supplierCode || null,
      lead_time_days: v.leadTimeDays,
      min_order_qty: v.minOrderQty,
      note: v.note || null,
    },
    { onConflict: "product_id,partner_id" },
  );
  if (error) throw new Error(error.message);
  refresh(productId);
}

export async function removeProductSupplier(productSupplierId: string) {
  await requirePermission("master-data:write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_suppliers").delete().eq("id", productSupplierId).select("product_id").single();
  if (error) throw new Error(error.message);
  refresh(data.product_id);
}

const priceSchema = z.object({
  price: z.number().min(0, "Negatif olamaz"),
  currency: z.enum(["TRY", "USD", "EUR"]),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin"),
  note: z.string().trim().max(200).nullable(),
  /** Ürün kartındaki birim fiyatı (maliyette kullanılan) da bu fiyatla güncelle */
  updateCardPrice: z.boolean(),
});
export type PriceValues = z.infer<typeof priceSchema>;

export async function addSupplierPrice(productSupplierId: string, values: PriceValues) {
  await requirePermission("master-data:write");
  const parsed = priceSchema.safeParse(values);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz fiyat.");
  const v = parsed.data;
  const supabase = await createClient();
  const { data: ps, error: psError } = await supabase.from("product_suppliers").select("product_id").eq("id", productSupplierId).single();
  if (psError) throw new Error("Tedarikçi kaydı bulunamadı.");
  const { error } = await supabase.from("supplier_prices").insert({ product_supplier_id: productSupplierId, price: v.price, currency: v.currency, valid_from: v.validFrom, note: v.note || null });
  if (error) throw new Error(error.message);
  if (v.updateCardPrice) {
    const { error: cardError } = await supabase.from("products").update({ unit_cost: v.price, currency: v.currency }).eq("id", ps.product_id);
    if (cardError) throw new Error("Fiyat kaydedildi ama kart fiyatı güncellenemedi: " + cardError.message);
  }
  refresh(ps.product_id);
  revalidatePath("/ana-veri");
}
