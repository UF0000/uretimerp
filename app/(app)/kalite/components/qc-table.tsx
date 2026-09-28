"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Plus } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { bulkDeleteQualityChecks } from "@/app/actions/quality";
import { useState } from "react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/utils";
import type { QualityCheckRow } from "@/app/actions/quality";
interface QCTableProps {
  data: QualityCheckRow[];
  onAdd: () => void;
}

const QC_TYPES: Record<string, string> = {
  incoming: "Girdi Kontrol",
  process: "Proses Kontrol",
  final: "Son Kontrol",
};

const QC_RESULTS: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
  accept: { label: "Kabul", variant: "default" },
  reject: { label: "Red", variant: "destructive" },
  conditional: { label: "Şartlı Kabul", variant: "secondary" },
};

export function QCTable({ data, onAdd }: QCTableProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleBulkDelete = async (ids: string[]) => {
    try {
      setIsDeleting(true);
      toast.loading("Kontroller siliniyor...", { id: "bulk-delete-qc" });
      await bulkDeleteQualityChecks(ids);
      toast.success(`${ids.length} adet kalite kontrol kaydı başarıyla silindi.`, { id: "bulk-delete-qc" });
    } catch (error) {
      toast.error("Toplu silme başarısız", { id: "bulk-delete-qc", description: getErrorMessage(error) });
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: ColumnDef<QualityCheckRow>[] = [
    {
      accessorKey: "type",
      header: "Kontrol Tipi",
      cell: ({ row }) => <span>{QC_TYPES[row.original.type as string]}</span>,
    },
    {
      id: "product_code",
      accessorFn: (row) => row.product?.code,
      header: "Ürün",
      cell: ({ row }) => (
        <div>
          <div className="font-semibold">{row.original.product?.code}</div>
          <div className="text-xs text-muted-foreground">{row.original.product?.name}</div>
        </div>
      ),
    },
    {
      accessorKey: "work_order.no",
      header: "İş Emri / Lot",
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.work_order?.no ? `İş Emri: ${row.original.work_order?.no}` : ""}
          {row.original.lot_no ? ` Lot: ${row.original.lot_no}` : ""}
        </div>
      ),
    },
    {
      accessorKey: "result",
      header: "Sonuç",
      cell: ({ row }) => {
        const res = QC_RESULTS[row.original.result as string];
        if (!res) return null;
        return <Badge variant={res.variant}>{res.label}</Badge>;
      },
    },
    {
      accessorKey: "checker.name",
      header: "Kontrol Eden",
      cell: ({ row }) => <span>{row.original.checker?.name}</span>,
    },
    {
      accessorKey: "checked_at",
      header: "Tarih",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.checked_at ? format(new Date(row.original.checked_at), "dd MMM yyyy HH:mm", { locale: tr }) : ""}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Kontrol Ekle
        </Button>
      </div>

      <DataTable 
        columns={columns} 
        data={data} 
        searchKey="product_code"
        searchPlaceholder="Ürün kodu ile ara..." 
        onDeleteSelected={handleBulkDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
