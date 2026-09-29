"use client";

import { useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";

import { saveOperator, setOperatorActive } from "@/app/actions/master-data/operators";
import { usePermission } from "@/components/shared/role-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/utils";
import { matchesTokens, searchTokens } from "@/lib/search";

export function OperatorsTab({ data }: { data: { id: string; name: string; active: boolean }[] }) {
  const canWrite = usePermission("master-data:write");
  const [pending, start] = useTransition();
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const tokens = searchTokens(q);
  const rows = data.filter((o) => matchesTokens(tokens, o.name));

  const run = (action: () => Promise<void>, ok: string, after?: () => void) =>
    start(async () => {
      try {
        await action();
        toast.success(ok);
        after?.();
      } catch (error) {
        toast.error("Kaydedilemedi", { description: getErrorMessage(error) });
      }
    });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium tracking-tight">Operatörler</h2>
        <p className="text-sm text-muted-foreground">Üretim girişinde listeden seçilir. Pasif operatör seçilemez; geçmiş girişlerde adı kalır.</p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/30 p-3">
        {canWrite && (
          <>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newName.trim() && run(() => saveOperator(newName), "Operatör eklendi", () => setNewName(""))} placeholder="Ad soyad" className="w-64" />
            <Button disabled={pending || !newName.trim()} onClick={() => run(() => saveOperator(newName), "Operatör eklendi", () => setNewName(""))}>
              <Plus className="mr-1.5 h-4 w-4" />
              Operatör ekle
            </Button>
          </>
        )}
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara…" className="ml-auto w-56" />
      </div>

      <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Ad soyad</th>
              <th className="w-24 px-3 py-2 font-medium">Aktif</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">
                  Operatör yok.
                </td>
              </tr>
            )}
            {rows.map((o) => {
              const draft = drafts[o.id] ?? o.name;
              const dirty = draft.trim() !== o.name && draft.trim() !== "";
              return (
                <tr key={o.id} className="border-b border-border last:border-0 even:bg-muted/30">
                  <td className="px-3 py-2">
                    {canWrite ? (
                      <div className="flex items-center gap-1">
                        <Input value={draft} onChange={(e) => setDrafts((d) => ({ ...d, [o.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && dirty && run(() => saveOperator(draft, o.id), "Ad güncellendi")} className="h-8 max-w-sm" />
                        {dirty && (
                          <Button size="icon" variant="ghost" disabled={pending} onClick={() => run(() => saveOperator(draft, o.id), "Ad güncellendi")} aria-label="Kaydet">
                            <Check className="h-4 w-4 text-success" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      o.name
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Switch checked={o.active} disabled={!canWrite || pending} aria-label={`${o.name} aktif`} onCheckedChange={(v) => run(() => setOperatorActive(o.id, v), v ? "Aktif edildi" : "Pasife alındı")} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
