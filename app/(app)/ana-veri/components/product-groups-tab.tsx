"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteProductGroup, saveProductGroup } from "@/app/actions/master-data/products";
import { usePermission } from "@/components/shared/role-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/utils";

interface Props {
  groups: { code: string; name: string }[];
  /** Ürünlerde kullanılan grup kodları ve ürün sayısı */
  usage: { code: string; count: number }[];
}

/**
 * Grup kodu adları. Ürünlerde kullanılan ama adı olmayan kodlar da listelenir;
 * ad verilince listede ve filtrelerde görünür.
 */
export function ProductGroupsTab({ groups, usage }: Props) {
  const canWrite = usePermission("master-data:write");
  const [pending, start] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");

  const rows = useMemo(() => {
    const names = new Map(groups.map((g) => [g.code, g.name]));
    const counts = new Map(usage.map((u) => [u.code, u.count]));
    const codes = [...new Set([...names.keys(), ...counts.keys()])].sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
    return codes.map((code) => ({ code, name: names.get(code) ?? null, count: counts.get(code) ?? 0 }));
  }, [groups, usage]);
  const unnamed = rows.filter((r) => !r.name).length;

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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium tracking-tight">Grup Kodları</h2>
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Ürün türü grupları. PE ürünlerinde stok kodunun son iki hanesinden gelir, PP ürünlerinde ürün kartına girilir.
            {unnamed > 0 && <span className="font-medium text-warning"> {unnamed} kodun adı yok.</span>}
          </p>
        </div>
      </div>

      {canWrite && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="space-y-1">
            <label htmlFor="new-group-code" className="text-xs text-muted-foreground">
              Grup kodu
            </label>
            <Input id="new-group-code" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Örn: 03" className="w-28" />
          </div>
          <div className="space-y-1">
            <label htmlFor="new-group-name" className="text-xs text-muted-foreground">
              Grup adı
            </label>
            <Input id="new-group-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Grup adı" className="w-64" />
          </div>
          <Button
            disabled={pending || !newCode.trim() || !newName.trim()}
            onClick={() =>
              run(() => saveProductGroup(newCode, newName), `${newCode.trim()} kaydedildi`, () => {
                setNewCode("");
                setNewName("");
              })
            }
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Grup ekle
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-muted-foreground">
            <tr>
              <th className="w-28 px-3 py-2 font-medium">Kod</th>
              <th className="px-3 py-2 font-medium">Ad</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Ürün sayısı</th>
              {canWrite && <th className="w-28 px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  Henüz grup kodu yok.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const draft = drafts[r.code] ?? r.name ?? "";
              const dirty = draft.trim() !== (r.name ?? "") && draft.trim() !== "";
              return (
                <tr key={r.code} className="border-b border-border last:border-0 even:bg-muted/30">
                  <td className="px-3 py-2 font-semibold">{r.code}</td>
                  <td className="px-3 py-2">
                    {canWrite ? (
                      <Input
                        value={draft}
                        placeholder="Ad verilmemiş"
                        onChange={(e) => setDrafts((d) => ({ ...d, [r.code]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && dirty && run(() => saveProductGroup(r.code, draft), `${r.code} kaydedildi`)}
                        className="h-8 max-w-md"
                      />
                    ) : (
                      (r.name ?? <Badge variant="outline">Ad verilmemiş</Badge>)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.count}</td>
                  {canWrite && (
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {dirty && (
                          <Button size="icon" variant="ghost" disabled={pending} onClick={() => run(() => saveProductGroup(r.code, draft), `${r.code} kaydedildi`)} aria-label="Kaydet" title="Kaydet">
                            <Check className="h-4 w-4 text-success" />
                          </Button>
                        )}
                        {r.name && (
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => confirm(`${r.code} grubunun adı silinsin mi? Ürünlerdeki kod kalır.`) && run(() => deleteProductGroup(r.code), `${r.code} adı silindi`)}
                            aria-label="Adı sil"
                            title="Adı sil"
                          >
                            <Trash2 className="h-4 w-4 text-danger" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
