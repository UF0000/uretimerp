"use client";

import { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, Plus, History } from "lucide-react";
import { useRouter } from "next/navigation";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import type { StockOverviewRow } from "@/app/actions/stock";
interface StockTableProps {
  data: StockOverviewRow[];
}

const TYPE_LABELS: Record<string, string> = {
  raw: "Hammadde",
  finished: "Mamul",
  semi: "Yarı Mamul",
  regrind: "Kırma",
  scrap: "Hurda",
};

export function StockTable({ data }: StockTableProps) {
  const router = useRouter();

  const columns: ColumnDef<StockOverviewRow>[] = [
    {
      accessorKey: "product.code",
      header: "Ürün Kodu",
      cell: ({ row }) => <span className="font-semibold">{row.original.product?.code}</span>,
    },
    {
      accessorKey: "product.name",
      header: "Ürün Adı",
      cell: ({ row }) => row.original.product?.name,
    },
    {
      accessorKey: "product.type",
      header: "Tip",
      cell: ({ row }) => {
        const type = row.original.product?.type;
        return <Badge variant="secondary">{TYPE_LABELS[type] || type}</Badge>;
      },
    },
    {
      accessorKey: "warehouse.name",
      header: "Bulunduğu Depo",
      cell: ({ row }) => row.original.warehouse?.name,
    },
    {
      accessorKey: "qty",
      header: "Miktar",
      cell: ({ row }) => {
        const qty = Number(row.original.qty) || 0;
        const unit = row.original.product?.unit;
        const minStock = Number(row.original.product?.min_stock) || 0;
        const criticalStock = Number(row.original.product?.critical_stock) || 0;
        
        let status = "ok"; // normal
        if (qty <= criticalStock && criticalStock > 0) status = "critical";
        else if (qty <= minStock && minStock > 0) status = "warning";

        return (
          <div className="flex items-center gap-2">
            <span className={`font-mono font-medium ${status === 'critical' ? 'text-danger' : status === 'warning' ? 'text-warning' : ''}`}>
              {qty.toLocaleString("tr-TR")} {unit}
            </span>
            {status !== 'ok' && (
              <AlertCircle className={`w-4 h-4 ${status === 'critical' ? 'text-danger' : 'text-warning'}`} />
            )}
          </div>
        );
      },
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium tracking-tight">Stok Analizi</h2>
          <p className="text-sm text-muted-foreground">
            Sistemdeki tüm güncel stoklar. Ürün arayabilirsiniz.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/depo/hareketler")}>
            <History className="w-4 h-4 mr-2" />
            Hareket Geçmişi
          </Button>
          <Button variant="default" onClick={() => router.push("/depo/fisler")}>
            Stok Fişleri (Toplu)
          </Button>
          <Button onClick={() => router.push("/depo/yeni-hareket")}>
            <Plus className="w-4 h-4 mr-2" />
            Tekil Fiş
          </Button>
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={data} 
        searchKey="product_name" 
        searchPlaceholder="Ürün ara..." 
        disablePagination={true}
      />
    </div>
  );
}
