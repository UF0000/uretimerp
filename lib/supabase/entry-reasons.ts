import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ReasonPart } from "@/lib/production-analytics";
import { inChunks } from "@/lib/supabase/read-all";

/** Girişlerin fire (kg) ve duruş (dk) satırları: giriş id → neden parçaları */
export async function loadReasonParts(supabase: SupabaseClient<Database>, entryIds: string[]) {
  const [scraps, downtimes] = await Promise.all([
    inChunks(entryIds, 150, (c) => supabase.from("production_entry_scraps").select("entry_id, reason_code_id, kg").in("entry_id", c)),
    inChunks(entryIds, 150, (c) => supabase.from("production_entry_downtimes").select("entry_id, reason_code_id, minutes").in("entry_id", c)),
  ]);
  const scrap = new Map<string, ReasonPart[]>();
  for (const s of scraps) scrap.set(s.entry_id, [...(scrap.get(s.entry_id) ?? []), { reasonId: s.reason_code_id, value: Number(s.kg) }]);
  const downtime = new Map<string, ReasonPart[]>();
  for (const d of downtimes) downtime.set(d.entry_id, [...(downtime.get(d.entry_id) ?? []), { reasonId: d.reason_code_id, value: Number(d.minutes) }]);
  return { scrap, downtime };
}
