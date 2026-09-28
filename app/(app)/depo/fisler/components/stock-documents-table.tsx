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
const TYPE_LABELS: Record<string, string> = {
  in_purchase: "Satınalma Girişi",
  in_production: "Üretimden Giriş",
  in_count: "Sayım Fazlası",
  transfer: "Depo Transferi",
  out_sale: "Satış Çıkışı",
  out_consumption: "Sarf / Üretime Çıkış",
  out_scrap: "Fire / Hurda",
  out_count: "Sayım Eksiği",
};

const TYPE_COLORS: Record<string, string> = {
  in_purchase: "border-success/30 bg-success/10 text-success",
  in_production: "border-success/30 bg-success/10 text-success",
  in_count: "border-success/30 bg-success/10 text-success",
  transfer: "border-info/30 bg-info/10 text-info",
  out_sale: "border-danger/30 bg-danger/10 text-danger",
  out_consumption: "border-danger/30 bg-danger/10 text-danger",
  out_scrap: "border-danger/30 bg-danger/10 text-danger",
  out_count: "border-danger/30 bg-danger/10 text-danger",
};

export function StockDocumentsTable({ data }: { data: StockDocumentRow[] }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCancel = async (id: string, no: string) => {
    if (confirm(`${no} numaralı fiş iptal edilecek. Fişteki tüm hareketler ters kayıtla geri alınır; fiş ve hareketler silinmez, geçmişte "İptal" olarak görünür. Devam edilsin mi?`)) {
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
          <span className={row.original.cancelled_at ? "font-medium text-muted-foreground line-through" : "font-medium"}>
            {row.getValue("no")}
          </span>
          {row.original.cancelled_at && <Badge variant="secondary">İptal</Badge>}
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
              <span className="text-danger font-medium">{doc.source?.name}</span>
              {" ➔ "}
              <span className="text-success font-medium">{doc.target?.name}</span>
            </span>
          );
        } else if (doc.type.startsWith("in_")) {
          return <span className="text-success font-medium">{doc.target?.name}</span>;
        } else {
          return <span className="text-danger font-medium">{doc.source?.name}</span>;
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
      columns={columns}
      data={data}
      searchKey="no"
      searchPlaceholder="Fiş No ile ara..."
    />
  );
}
