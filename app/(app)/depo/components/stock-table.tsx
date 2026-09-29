"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, History, Plus, RotateCcw, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { DataTable } from "@/components/shared/data-table";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { StockOverviewRow } from "@/app/actions/stock";
import { usePermission } from "@/components/shared/role-provider";
import { CATEGORY_LABELS, PRODUCT_TYPE_LABELS, PRODUCT_TYPES, categoryLabel, compareByGroup, type ProductType } from "@/lib/product-meta";
import { formatTR } from "@/lib/format";
import { matchesTokens, searchTokens } from "@/lib/search";
import { cn } from "@/lib/utils";

interface StockTableProps {
  data: StockOverviewRow[];
  warehouses: { id: string; name: string; type: string }[];
  groups: { code: string; name: string }[];
}

const ALL = "";
const NO_WAREHOUSE = "__none__";
type StockStatus = "critical" | "warning" | "ok";

const statusOf = (r: StockOverviewRow): StockStatus => {
  const qty = r.qty;
  const critical = Number(r.product.critical_stock) || 0;
  const min = Number(r.product.min_stock) || 0;
  if (critical > 0 && qty <= critical) return "critical";
  if (min > 0 && qty <= min) return "warning";
  return "ok";
};

const STATUS_OPTIONS = [
  { value: ALL, label: "Stok durumu: hepsi" },
  { value: "stokta", label: "Stokta olanlar" },
  { value: "critical", label: "Kritik seviyede" },
  { value: "warning", label: "Min. altında" },
  { value: "stoksuz", label: "Stoksuz (0)" },
];

export function StockTable({ data, warehouses, groups }: StockTableProps) {
  const canWrite = usePermission("stock:write");
  const router = useRouter();

  const [q, setQ] = useState("");
  const [selectedWh, setSelectedWh] = useState<Set<string>>(new Set());
  const [type, setType] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [groupCode, setGroupCode] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const groupCodes = useMemo(
    () => [...new Set([...groups.map((g) => g.code), ...data.map((r) => r.product.group_code).filter((c): c is string => Boolean(c))])].sort((a, b) => a.localeCompare(b, "tr", { numeric: true })),
    [data, groups],
  );

  // Depo dışındaki filtrelerden geçen satırlar (depo düğmelerindeki sayılar bunlara göre)
  const baseFiltered = useMemo(() => {
    const tokens = searchTokens(q);
    return data.filter((r) => {
      const p = r.product;
      if (!matchesTokens(tokens, p.code, p.name, p.group_code, p.material_group, r.warehouse?.name)) return false;
      if (type && p.type !== type) return false;
      if (category && p.category !== category) return false;
      if (groupCode && p.group_code !== groupCode) return false;
      if (status === "stokta" && r.qty <= 0) return false;
      if (status === "stoksuz" && r.qty !== 0) return false;
      if ((status === "critical" || status === "warning") && statusOf(r) !== status) return false;
      return true;
    }).sort((a, b) => compareByGroup(a.product, b.product));
  }, [data, q, type, category, groupCode, status]);

  const filtered = useMemo(
    () => (selectedWh.size ? baseFiltered.filter((r) => selectedWh.has(r.warehouse?.id ?? NO_WAREHOUSE)) : baseFiltered),
    [baseFiltered, selectedWh],
  );

  const whCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of baseFiltered) {
      const k = r.warehouse?.id ?? NO_WAREHOUSE;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [baseFiltered]);

  const totals = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.product.unit, (m.get(r.product.unit) ?? 0) + r.qty);
    return [...m.entries()].filter(([, v]) => v !== 0);
  }, [filtered]);

  const toggleWh = (id: string) =>
    setSelectedWh((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const anyFilter = Boolean(q || type || category || groupCode || status || selectedWh.size);
  const clear = () => {
    setQ("");
    setType(ALL);
    setCategory(ALL);
    setGroupCode(ALL);
    setStatus(ALL);
    setSelectedWh(new Set());
  };

  const columns: ColumnDef<StockOverviewRow>[] = [
    { id: "code", accessorFn: (r) => r.product.code, header: "Ürün kodu", cell: ({ row }) => <span className="font-semibold">{row.original.product.code}</span> },
    { id: "name", accessorFn: (r) => r.product.name, header: "Ürün adı" },
    {
      id: "type",
      accessorFn: (r) => r.product.type,
      header: "Tür",
      cell: ({ row }) => <Badge variant="secondary">{PRODUCT_TYPE_LABELS[row.original.product.type as ProductType] ?? row.original.product.type}</Badge>,
    },
    { id: "category", accessorFn: (r) => r.product.category, header: "Aile", cell: ({ row }) => categoryLabel(row.original.product.category) },
    {
      id: "group",
      accessorFn: (r) => r.product.group_code,
      header: "Grup kodu",
      cell: ({ row }) => {
        const g = row.original.product.group_code;
        if (!g) return <span className="text-muted-foreground">—</span>;
        return <span className="font-medium">{g}</span>;
      },
    },
    { id: "warehouse", accessorFn: (r) => r.warehouse?.name ?? "", header: "Depo", cell: ({ row }) => row.original.warehouse?.name ?? <span className="text-muted-foreground">—</span> },
    {
      id: "qty",
      accessorFn: (r) => r.qty,
      header: "Miktar",
      cell: ({ row }) => {
        const s = statusOf(row.original);
        return (
          <div className="flex items-center gap-2">
            <span className={cn("font-mono font-medium tabular-nums", s === "critical" && "text-danger", s === "warning" && "text-warning")}>
              {formatTR(row.original.qty, 0)} {row.original.product.unit}
            </span>
            {s !== "ok" && <AlertCircle className={cn("h-4 w-4", s === "critical" ? "text-danger" : "text-warning")} aria-label={s === "critical" ? "Kritik" : "Min. altında"} />}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div>
          <h2 className="text-lg font-medium tracking-tight">Stok Analizi</h2>
          <p className="text-sm text-muted-foreground">Depo, tür, aile, grup kodu ve stok durumuna göre filtreleyin · ürün kartı için satıra çift tıklayın</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/depo/hareketler")}>
            <History className="mr-2 h-4 w-4" />
            Hareket Geçmişi
          </Button>
          <Button variant="default" onClick={() => router.push("/depo/fisler")}>
            Stok Fişleri (Toplu)
          </Button>
          {canWrite && (
            <Button onClick={() => router.push("/depo/yeni-hareket")}>
              <Plus className="mr-2 h-4 w-4" />
              Tekil Fiş
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Depolar:</span>
          <Button size="sm" variant={selectedWh.size === 0 ? "default" : "outline"} onClick={() => setSelectedWh(new Set())}>
            Tümü ({baseFiltered.length})
          </Button>
          {warehouses.map((w) => (
            <Button key={w.id} size="sm" variant={selectedWh.has(w.id) ? "default" : "outline"} onClick={() => toggleWh(w.id)} aria-pressed={selectedWh.has(w.id)}>
              {w.name} ({whCount.get(w.id) ?? 0})
            </Button>
          ))}
          {(whCount.get(NO_WAREHOUSE) ?? 0) > 0 && (
            <Button size="sm" variant={selectedWh.has(NO_WAREHOUSE) ? "default" : "outline"} onClick={() => toggleWh(NO_WAREHOUSE)}>
              Hareketi yok ({whCount.get(NO_WAREHOUSE)})
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <div className="relative col-span-2 md:col-span-3 xl:col-span-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara: kelimeler ayrı ayrı aranır (ör. henq sdr 6)" className="pl-9" />
          </div>
          <SearchableSelect value={type} onValueChange={setType} placeholder="Tüm türler" options={[{ value: ALL, label: "Tüm türler" }, ...PRODUCT_TYPES.map((t) => ({ value: t, label: PRODUCT_TYPE_LABELS[t] }))]} />
          <SearchableSelect value={category} onValueChange={setCategory} placeholder="Tüm aileler" options={[{ value: ALL, label: "Tüm aileler" }, ...Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v }))]} />
          <SearchableSelect
            value={groupCode}
            onValueChange={setGroupCode}
            placeholder="Tüm grup kodları"
            options={[{ value: ALL, label: "Tüm grup kodları" }, ...groupCodes.map((c) => ({ value: c, label: c }))]}
          />
          <div className="flex gap-2">
            <SearchableSelect value={status} onValueChange={setStatus} placeholder="Stok durumu: hepsi" options={STATUS_OPTIONS} />
            {anyFilter && (
              <Button variant="ghost" size="icon" onClick={clear} aria-label="Filtreleri temizle" title="Filtreleri temizle">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">{filtered.length} satır</span>
          {totals.map(([unit, total]) => (
            <span key={unit}>
              Toplam: <span className="font-semibold tabular-nums">{formatTR(total, 0)}</span> {unit}
            </span>
          ))}
        </div>
      </div>

      <DataTable storageKey="stock-overview" columns={columns} data={filtered} onRowDoubleClick={(r) => router.push(`/ana-veri/urunler/${r.product.id}`)} />
    </div>
  );
}
