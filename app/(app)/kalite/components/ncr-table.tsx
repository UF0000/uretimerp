"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Lock, Plus } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermission } from "@/components/shared/role-provider";
import { formatTR } from "@/lib/format";
import type { NcrRow } from "@/app/actions/quality";

interface NcrTableProps {
  data: NcrRow[];
  onAdd: () => void;
  onCloseNcr: (ncr: NcrRow) => void;
}

const DISPOSITION: Record<string, string> = { release: "Serbest bırakıldı", scrap: "İmha edildi" };

export function NcrTable({ data, onAdd, onCloseNcr }: NcrTableProps) {
  const canWrite = usePermission("quality:write");

  const columns: ColumnDef<NcrRow>[] = [
    {
      accessorKey: "no",
      header: "NCR No",
      cell: ({ row }) => (
        <div>
          <div className="font-semibold">{row.original.no}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.created_at ? format(new Date(row.original.created_at), "dd MMM yyyy", { locale: tr }) : ""}
            {row.original.creator?.name ? ` · ${row.original.creator.name}` : ""}
          </div>
        </div>
      ),
    },
    {
      id: "product",
      header: "Ürün / Lot",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.product?.code}</div>
          {row.original.lot_no && (
            <Link
              href={`/depo/izlenebilirlik?lot=${encodeURIComponent(row.original.lot_no)}`}
              className="font-mono text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {row.original.lot_no}
            </Link>
          )}
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Uygunsuzluk",
      cell: ({ row }) => (
        <div className="max-w-xs text-sm">
          <div>{row.original.description}</div>
          {row.original.status === "closed" && row.original.root_cause && (
            <div className="mt-1 text-xs text-muted-foreground">
              Kök neden: {row.original.root_cause} · Düzeltici: {row.original.corrective_action}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "quantity",
      header: "Miktar",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatTR(Number(row.original.quantity), 2)} {row.original.product?.unit}
        </span>
      ),
    },
    {
      id: "quarantine",
      header: "Karantina",
      cell: ({ row }) => {
        const n = row.original;
        if (!n.quarantine_warehouse_id) return <span className="text-sm text-muted-foreground">-</span>;
        if (n.disposition) return <span className="text-sm">{DISPOSITION[n.disposition]}</span>;
        return <span className="text-sm">Bekliyor ({n.quarantine?.name})</span>;
      },
    },
    {
      accessorKey: "status",
      header: "Durum",
      cell: ({ row }) =>
        row.original.status === "open" ? (
          <Badge variant="destructive">Açık</Badge>
        ) : (
          <Badge variant="outline">Kapalı</Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        row.original.status === "open" ? (
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => onCloseNcr(row.original)}>
              <Lock className="mr-1 h-4 w-4" /> Kapat
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canWrite && (
          <Button onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Yeni NCR
          </Button>
        )}
      </div>
      <DataTable
        columns={canWrite ? columns : columns.filter((c) => c.id !== "actions")}
        data={data}
        searchKey="no"
        searchPlaceholder="NCR no ile ara..."
      />
    </div>
  );
}
