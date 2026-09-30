"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Info, Loader2, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { getActivityLog, type ActivityGroup, type ActivityItem } from "@/app/actions/admin/activity";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AUDIT_OPERATIONS,
  AUDIT_OP_BADGE,
  AUDIT_OP_LABELS,
  AUDIT_TABLE_LABELS,
  auditFieldLabel,
  auditOpLabel,
  auditTableLabel,
  auditValue,
  type AuditOperation,
} from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { matchesTokens, searchTokens } from "@/lib/search";
import { getErrorMessage } from "@/lib/utils";

interface ActivityPanelProps {
  users: { id: string; name: string }[];
}

const ALL = "";
/** Ayrıntıda bir grupta gösterilen en fazla kayıt */
const MAX_ITEMS_SHOWN = 200;
/** Eklenen / silinen kayıtta gösterilen alan sayısı */
const MAX_ROW_FIELDS = 8;
const HIDDEN_ROW_FIELDS = new Set(["id", "created_at", "updated_at"]);

const isoDay = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86400000));

export function ActivityPanel({ users }: ActivityPanelProps) {
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(daysAgo(0));
  const [userId, setUserId] = useState(ALL);
  const [table, setTable] = useState(ALL);
  const [operation, setOperation] = useState(ALL);
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ key: string; groups: ActivityGroup[]; truncated: boolean } | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Filtre değişince yeniden oku; sonuç hangi filtreye aitse "yükleniyor" ondan anlaşılır
  const filterKey = JSON.stringify([from, to, userId, table, operation]);
  const loading = result?.key !== filterKey;
  useEffect(() => {
    let alive = true;
    getActivityLog({ from, to, userId: userId || null, table: table || null, operation: (operation || null) as AuditOperation | null })
      .then((r) => alive && setResult({ key: filterKey, ...r }))
      .catch((error) => {
        if (!alive) return;
        setResult({ key: filterKey, groups: [], truncated: false });
        toast.error("İşlem geçmişi getirilemedi", { description: getErrorMessage(error) });
      });
    return () => {
      alive = false;
    };
  }, [filterKey, from, to, userId, table, operation]);

  // Kayıt adı / kodu ve değişen alanlarda kelime kelime arama
  const groups = useMemo(() => {
    const tokens = searchTokens(q);
    const list = result?.groups ?? [];
    if (!tokens.length) return list;
    return list.filter((g) => g.items.some((i) => matchesTokens(tokens, i.label, i.recordId, g.userName, auditTableLabel(g.table), JSON.stringify(i.changes))));
  }, [result, q]);

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const reset = () => {
    setFrom(daysAgo(6));
    setTo(daysAgo(0));
    setUserId(ALL);
    setTable(ALL);
    setOperation(ALL);
    setQ("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          Sistemdeki her ekleme, değişiklik, silme ve geri alma otomatik kaydedilir (ekrandan, Excel aktarımından ya da toplu işlemle). Kayıtlar değiştirilemez ve silinemez.
          Aynı anda yapılan toplu işlemler tek satırda görünür; ayrıntı için satıra tıklayın.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/30 p-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-1">
          <Label htmlFor="act-from" className="text-xs">Başlangıç</Label>
          <Input id="act-from" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="act-to" className="text-xs">Bitiş</Label>
          <Input id="act-to" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Kullanıcı</Label>
          <SearchableSelect value={userId} onValueChange={setUserId} placeholder="Tüm kullanıcılar" options={[{ value: ALL, label: "Tüm kullanıcılar" }, ...users.map((u) => ({ value: u.id, label: u.name }))]} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Bölüm</Label>
          <SearchableSelect
            value={table}
            onValueChange={setTable}
            placeholder="Tüm bölümler"
            options={[{ value: ALL, label: "Tüm bölümler" }, ...Object.entries(AUDIT_TABLE_LABELS).sort((a, b) => a[1].localeCompare(b[1], "tr")).map(([k, v]) => ({ value: k, label: v }))]}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">İşlem</Label>
          <SearchableSelect value={operation} onValueChange={setOperation} placeholder="Tüm işlemler" options={[{ value: ALL, label: "Tüm işlemler" }, ...AUDIT_OPERATIONS.map((o) => ({ value: o, label: AUDIT_OP_LABELS[o] }))]} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="act-q" className="text-xs">Kayıtta ara</Label>
          <div className="flex gap-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="act-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kod, ad…" className="pl-9" />
            </div>
            <Button variant="ghost" size="icon" onClick={reset} aria-label="Filtreleri sıfırla" title="Filtreleri sıfırla">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <span>{groups.length} işlem</span>
        {result?.truncated && <span className="text-warning">· Çok fazla kayıt var, yalnızca en yeni 5.000 değişiklik okundu; tarih aralığını daraltın.</span>}
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="px-3 py-2 font-medium">Zaman</th>
              <th className="px-3 py-2 font-medium">Kullanıcı</th>
              <th className="px-3 py-2 font-medium">Bölüm</th>
              <th className="px-3 py-2 font-medium">İşlem</th>
              <th className="px-3 py-2 font-medium">Kayıt</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Bu aralıkta kayıt yok.
                </td>
              </tr>
            )}
            {groups.map((g) => {
              const isOpen = open.has(g.key);
              const op = g.operation as AuditOperation;
              return (
                <Fragment key={g.key}>
                  <tr className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40" onClick={() => toggle(g.key)}>
                    <td className="px-2 py-2 text-muted-foreground">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDateTime(g.at)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{g.userName}</td>
                    <td className="whitespace-nowrap px-3 py-2">{auditTableLabel(g.table)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={AUDIT_OP_BADGE[op] ?? "secondary"}>{auditOpLabel(g.operation)}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      {g.items.length > 1 ? (
                        <span className="font-medium">{g.items.length} kayıt</span>
                      ) : (
                        <span className="font-medium">{g.items[0]?.label ?? g.items[0]?.recordId ?? "—"}</span>
                      )}
                      {g.operation === "update" && (
                        <span className="ml-2 text-muted-foreground">
                          ({[...new Set(g.items.flatMap((i) => Object.keys(i.changes ?? {})))].map(auditFieldLabel).join(", ")})
                        </span>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-border bg-muted/20 last:border-0">
                      <td />
                      <td colSpan={5} className="px-3 py-3">
                        <div className="space-y-2">
                          {g.items.slice(0, MAX_ITEMS_SHOWN).map((i) => (
                            <ItemDetail key={i.id} item={i} operation={g.operation} />
                          ))}
                          {g.items.length > MAX_ITEMS_SHOWN && <p className="text-xs text-muted-foreground">… ve {g.items.length - MAX_ITEMS_SHOWN} kayıt daha</p>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ItemDetail({ item, operation }: { item: ActivityItem; operation: string | null }) {
  const changes = item.changes ?? {};
  const isDiff = operation === "update" || operation === "deactivate" || operation === "restore";
  return (
    <div className="rounded border border-border bg-card px-3 py-2">
      <p className="font-medium">{item.label ?? item.recordId ?? "—"}</p>
      {isDiff ? (
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {Object.entries(changes).map(([field, pair]) => {
            const [before, after] = Array.isArray(pair) ? pair : [undefined, pair];
            return (
              <li key={field}>
                <span className="text-foreground">{auditFieldLabel(field)}:</span> {auditValue(before)} → <span className="text-foreground">{auditValue(after)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1 text-muted-foreground">
          {Object.entries(changes)
            .filter(([k, v]) => !HIDDEN_ROW_FIELDS.has(k) && v !== null && v !== "")
            .slice(0, MAX_ROW_FIELDS)
            .map(([k, v]) => `${auditFieldLabel(k)}: ${auditValue(v)}`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
