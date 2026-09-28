"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { reverseStockMovements } from "@/app/actions/stock";
import { useState } from "react";
import { toast } from "sonner";

import type { StockMovementRow } from "@/app/actions/stock";
import { getErrorMessage } from "@/lib/utils";
interface MovementTableProps {
  data: StockMovementRow[];
}

const SOURCE_LABELS: Record<string, string> = {
  production: "Üretim",
  sale: "Satış / İrsaliye",
  purchase: "Satınalma",
  count: "Sayım",
  transfer: "Transfer",
  scrap: "Fire / Hurda",
};

export function MovementTable({ data }: MovementTableProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleBulkReverse = async (ids: string[]) => {
    try {
      setIsDeleting(true);
      toast.loading("Ters kayıtlar oluşturuluyor...", { id: "bulk-reverse-movements" });
      const count = await reverseStockMovements(ids);
      const skipped = ids.length - count;
      toast.success(
        `${count} hareket ters kayıtla iptal edildi.`,
        {
          id: "bulk-reverse-movements",
          description: skipped > 0 ? `${skipped} hareket zaten iptal edilmiş veya kendisi bir ters kayıt olduğu için atlandı.` : undefined,
        }
      );
    } catch (error) {
      toast.error("İptal başarısız", {
        id: "bulk-reverse-movements",
        description: getErrorMessage(error),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: ColumnDef<StockMovementRow>[] = [
    {
      accessorKey: "created_at",
      header: "Tarih",
      cell: ({ row }) => row.original.created_at ? format(new Date(row.original.created_at), "dd MMM yyyy HH:mm", { locale: tr }) : "-",
    },
    {
      accessorKey: "direction",
      header: "İşlem Yönü",
      cell: ({ row }) => {
        const dir = row.original.direction;
        if (dir === "in") {
          return <Badge className="bg-success/10 text-success hover:bg-success/20"><ArrowDownRight className="w-3 h-3 mr-1" /> Giriş</Badge>;
        }
        return <Badge variant="destructive" className="bg-danger/10 text-danger hover:bg-danger/20"><ArrowUpRight className="w-3 h-3 mr-1" /> Çıkış</Badge>;
      },
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
      accessorKey: "quantity",
      header: "Miktar",
      cell: ({ row }) => {
        const dir = row.original.direction;
        const qty = Number(row.original.quantity);
        return (
          <span className={`font-mono font-medium ${dir === 'in' ? 'text-success' : 'text-danger'}`}>
            {dir === 'in' ? '+' : '-'}{qty.toLocaleString("tr-TR")} {row.original.product?.unit}
          </span>
        );
      },
    },
    {
      accessorKey: "warehouse.name",
      header: "Depo",
      cell: ({ row }) => row.original.warehouse?.name,
    },
    {
      accessorKey: "source_type",
      header: "Hareket Tipi",
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span>{SOURCE_LABELS[row.original.source_type] || row.original.source_type}</span>
          {row.original.reverses_id && <Badge variant="outline">Ters kayıt</Badge>}
          {row.original.is_reversed && <Badge variant="secondary">İptal edildi</Badge>}
        </div>
      ),
    },
    {
      accessorKey: "user.name",
      header: "İşlemi Yapan",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.user?.name}</span>,
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => router.push("/depo/yeni-hareket")}>
          <Plus className="w-4 h-4 mr-2" />
          Manuel Fiş
        </Button>
      </div>

      <DataTable 
        columns={columns} 
        data={data} 
        searchKey="product_code" 
        searchPlaceholder="Kod ile ara..." 
        onDeleteSelected={handleBulkReverse}
        isDeleting={isDeleting}
        bulkActionLabel="Seçilenleri İptal Et"
        bulkConfirmText="Seçili {n} hareket için ters kayıt oluşturulacak ve stok eski haline dönecek. Kayıtlar silinmez, geçmişte görünmeye devam eder. Devam edilsin mi?"
      />
    </div>
  );
}
