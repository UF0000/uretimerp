"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { z } from "@/lib/zod";
import { AUDIT_OPERATIONS } from "@/lib/audit";

const filterSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Başlangıç tarihi geçersiz"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitiş tarihi geçersiz"),
  userId: z.string().uuid().nullable(),
  table: z.string().max(60).nullable(),
  operation: z.enum(AUDIT_OPERATIONS).nullable(),
});
export type ActivityFilter = z.input<typeof filterSchema>;

/** Tek seferde en fazla okunan satır (tarih aralığını daraltarak daha eskilere bakılır) */
const MAX_ROWS = 5000;

export interface ActivityItem {
  id: string;
  recordId: string | null;
  label: string | null;
  changes: Record<string, unknown> | null;
}

/** Aynı işlemde (transaction) aynı tabloda aynı işlem türü → tek satır (ör. "272 ürün silindi") */
export interface ActivityGroup {
  key: string;
  at: string;
  userId: string | null;
  userName: string;
  table: string | null;
  operation: string | null;
  items: ActivityItem[];
}

export async function getActivityLog(filter: ActivityFilter) {
  await requirePermission("admin:all");
  const parsed = filterSchema.safeParse(filter);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz filtre.");
  const f = parsed.data;
  const supabase = await createClient();

  // Tarihler İstanbul saatine göre gün başı / gün sonu
  let query = supabase
    .from("activity_log")
    .select("id, created_at, user_id, table_name, record_id, record_label, operation, changes, txid, user:profiles(name)")
    .gte("created_at", `${f.from}T00:00:00+03:00`)
    .lte("created_at", `${f.to}T23:59:59.999+03:00`)
    .not("table_name", "is", null)
    .order("created_at", { ascending: false })
    .order("id")
    .limit(MAX_ROWS);
  if (f.userId) query = query.eq("user_id", f.userId);
  if (f.table) query = query.eq("table_name", f.table);
  if (f.operation) query = query.eq("operation", f.operation);

  const { data, error } = await query;
  if (error) throw new Error("İşlem geçmişi getirilemedi: " + error.message);

  const groups = new Map<string, ActivityGroup>();
  for (const r of data) {
    const key = `${r.txid ?? r.id}|${r.table_name}|${r.operation}`;
    let g = groups.get(key);
    if (!g) {
      const user = Array.isArray(r.user) ? r.user[0] : r.user;
      g = {
        key,
        at: r.created_at ?? "",
        userId: r.user_id,
        userName: user?.name ?? (r.user_id ? "Bilinmeyen kullanıcı" : "Sistem"),
        table: r.table_name,
        operation: r.operation,
        items: [],
      };
      groups.set(key, g);
    }
    g.items.push({
      id: r.id,
      recordId: r.record_id,
      label: r.record_label,
      changes: r.changes && typeof r.changes === "object" && !Array.isArray(r.changes) ? (r.changes as Record<string, unknown>) : null,
    });
  }
  return { groups: [...groups.values()], truncated: data.length >= MAX_ROWS };
}

export type ActivityLogResult = Awaited<ReturnType<typeof getActivityLog>>;
