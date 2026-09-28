"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

import { DataTable } from "@/components/shared/data-table";
import { cn, formatCurrency } from "@/lib/utils";
import { formatTR } from "@/lib/format";

import type { CostRow } from "@/app/actions/cost";
interface CostTableProps {
  data: CostRow[];
}

/** Gerçekleşenin planlanandan sapması (%); plan yoksa null. */
const deviationPct = (m: CostRow["metrics"]): number | null =>
  m.plannedMaterialCost && m.plannedMaterialCost > 0
    ? ((m.rawMaterialCost - m.plannedMaterialCost) / m.plannedMaterialCost) * 100
    : null;

export function CostTable({ data }: CostTableProps) {
  const columns: ColumnDef<CostRow>[] = [
    {
      accessorKey: "no",
      header: "İş Emri",
      cell: ({ row }) => (
        <div>
          <div className="font-semibold">{row.original.no}</div>
          {row.original.bomLabel && (
            <div className="text-xs text-muted-foreground">{row.original.bomLabel}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "product.code",
      header: "Ürün",
      cell: ({ row }) => (
        <div>
          <div className="font-semibold">{row.original.product?.code}</div>
          <div className="text-xs text-muted-foreground">{row.original.product?.name}</div>
        </div>
      ),
    },
    {
      accessorKey: "finished_at",
      header: "Tamamlanma",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.finished_at ? format(new Date(row.original.finished_at), "dd MMM yyyy", { locale: tr }) : "-"}
        </span>
      ),
    },
    {
      accessorKey: "metrics.produced",
      header: "Üretilen",
      cell: ({ row }) => (
        <div className="font-mono text-sm">
          <div>{formatTR(row.original.metrics.produced, 0)} {row.original.product?.unit}</div>
          <div className="text-xs text-muted-foreground">
            {formatTR(row.original.metrics.consumedKg)} kg hammadde · {formatTR(row.original.metrics.scrapKg)} kg fire
          </div>
        </div>
      ),
    },
    {
      accessorKey: "metrics.rawMaterialCost",
      header: "Hammadde (Gerçekleşen / Plan)",
      cell: ({ row }) => {
        const m = row.original.metrics;
        const dev = deviationPct(m);
        return (
          <div className="text-sm">
            <div>{formatCurrency(m.rawMaterialCost)}</div>
            <div className="text-xs text-muted-foreground">
              Plan: {m.plannedMaterialCost !== null ? formatCurrency(m.plannedMaterialCost) : "reçetede ağırlık yok"}
              {dev !== null && (
                <span className={cn("ml-1 font-medium", dev > 5 ? "text-danger" : dev < -5 ? "text-success" : "")}>
                  ({dev > 0 ? "+" : ""}{formatTR(dev, 1)}%)
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "metrics.scrapRecovery",
      header: "Fire Geri Kazanım",
      cell: ({ row }) => (
        <span className="text-sm text-success">
          {row.original.metrics.scrapRecovery > 0 ? `−${formatCurrency(row.original.metrics.scrapRecovery)}` : "-"}
        </span>
      ),
    },
    {
      accessorKey: "metrics.totalCost",
      header: "Toplam Maliyet",
      cell: ({ row }) => {
        const m = row.original.metrics;
        return (
          <div>
            <div className="font-semibold text-primary">{formatCurrency(m.totalCost)}</div>
            <div className="text-xs text-muted-foreground">
              İşçilik {formatCurrency(m.laborCost)} · Enerji {formatCurrency(m.energyCost)} · Genel {formatCurrency(m.overheadCost)}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "metrics.unitCostFinal",
      header: "Birim Maliyet",
      cell: ({ row }) => (
        <span className="font-bold text-success">
          {formatCurrency(row.original.metrics.unitCostFinal)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={data}
        searchKey="no"
        searchPlaceholder="İş emri ara..."
      />
    </div>
  );
}
