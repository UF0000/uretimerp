"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cancelStockDocument } from "@/app/actions/stock";

import type { StockDocumentRow } from "@/app/actions/stock";
import { getErrorMessage } from "@/lib/utils";
import { usePermission } from "@/components/shared/role-provider";
import { STOCK_DOCUMENT_TYPE_COLORS, STOCK_DOCUMENT_TYPE_LABELS } from "@/lib/stock-documents";
import Link from "next/link";
const TYPE_LABELS = STOCK_DOCUMENT_TYPE_LABELS;
const TYPE_COLORS = STOCK_DOCUMENT_TYPE_COLORS;

export function StockDocumentsTable({ data }: { data: StockDocumentRow[] }) {
  const canWrite = usePermission("stock:write");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCancel = async (id: string, no: string) => {
    if (
      confirm(
        `${no} numaralı fiş iptal edilecek. Fişteki tüm hareketler ters kayıtla geri alınır; fiş ve hareketler silinmez, geçmişte "İptal" olarak görünür. Devam edilsin mi?`,
      )
    ) {
      try {
        setIsDeleting(true);
        await cancelStockDocument(id);
        toast.success("Stok fişi iptal edildi.");
      } catch (error) {
        toast.error("İptal başarısız", { description: getErrorMessage(error) });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const columns: ColumnDef<StockDocumentRow>[] = [
    {
      accessorKey: "no",
      header: "Fiş No",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/depo/fisler/${row.original.id}`}
            className={
              row.original.cancelled_at
                ? "font-medium text-muted-foreground line-through underline-offset-2 hover:underline"
                : "font-medium text-primary underline-offset-2 hover:underline"
            }
            title="Fişi aç / yazdır"
          >
            {row.getValue("no")}
          </Link>
          {row.original.cancelled_at && (
            <Badge variant="secondary">İptal</Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Fiş Tipi",
      cell: ({ row }) => {
        const type = row.getValue("type") as string;
        return (
          <Badge variant="outline" className={TYPE_COLORS[type] || ""}>
            {TYPE_LABELS[type] || type}
          </Badge>
        );
      },
    },
    {
      accessorKey: "document_date",
      header: "Tarih",
      cell: ({ row }) => {
        const date = row.getValue("document_date");
        if (!date) return "-";
        return format(new Date(date as string), "dd MMM yyyy", { locale: tr });
      },
    },
    {
      id: "warehouses",
      header: "Depo(lar)",
      cell: ({ row }) => {
        const doc = row.original;
        if (doc.type === "transfer") {
          return (
            <span className="text-sm">
              <span className="text-danger font-medium">
                {doc.source?.name}
              </span>
              {" ➔ "}
              <span className="text-success font-medium">
                {doc.target?.name}
              </span>
            </span>
          );
        } else if (doc.type.startsWith("in_")) {
          return (
            <span className="text-success font-medium">{doc.target?.name}</span>
          );
        } else {
          return (
            <span className="text-danger font-medium">{doc.source?.name}</span>
          );
        }
      },
    },
    {
      accessorKey: "user.name",
      header: "Kullanıcı",
    },
    {
      accessorKey: "note",
      header: "Açıklama",
    },
    {
      id: "actions",
      header: "İşlemler",
      cell: ({ row }) => {
        const doc = row.original;
        if (doc.cancelled_at) return null;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCancel(doc.id, doc.no)}
              disabled={isDeleting}
              aria-label="Fişi iptal et"
              title="Fişi iptal et"
            >
              <Ban className="w-4 h-4 text-danger" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={canWrite ? columns : columns.filter((c) => c.id !== "actions")}
      data={data}
      searchKey="no"
      searchPlaceholder="Fiş No ile ara..."
    />
  );
}
