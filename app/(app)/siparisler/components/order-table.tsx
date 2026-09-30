"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Plus, Truck } from "lucide-react";
import { useRouter } from "next/navigation";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { bulkDeleteOrders } from "@/app/actions/orders";
import { useState } from "react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/utils";
import type { OrderRow } from "@/app/actions/orders";
import { usePermission } from "@/components/shared/role-provider";
interface OrderTableProps {
  data: OrderRow[];
}

const STATUS_LABELS: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  open: { label: "Açık", variant: "default" },
  in_production: { label: "Üretimde", variant: "outline" },
  done: { label: "Tamamlandı", variant: "secondary" },
  cancelled: { label: "İptal", variant: "destructive" },
};

export function OrderTable({ data }: OrderTableProps) {
  const canWrite = usePermission("order:write");
  const canShip = usePermission("stock:write");
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleBulkDelete = async (ids: string[]) => {
    if (
      confirm(`Seçili ${ids.length} siparişi silmek istediğinize emin misiniz?`)
    ) {
      try {
        setIsDeleting(true);
        toast.loading("Siparişler siliniyor...", { id: "bulk-delete-orders" });
        await bulkDeleteOrders(ids);
        toast.success(`${ids.length} adet sipariş başarıyla silindi.`, {
          id: "bulk-delete-orders",
        });
      } catch (error) {
        toast.error("Toplu silme başarısız", {
          id: "bulk-delete-orders",
          description: getErrorMessage(error),
        });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const columns: ColumnDef<OrderRow>[] = [
    {
      accessorKey: "no",
      header: "Sipariş No",
      cell: ({ row }) => (
        <span className="font-semibold">{row.original.no}</span>
      ),
    },
    {
      accessorKey: "partner.name",
      header: "Müşteri / Cari",
      cell: ({ row }) => row.original.partner?.name,
    },
    {
      accessorKey: "order_date",
      header: "Sipariş Tarihi",
      cell: ({ row }) =>
        format(new Date(row.original.order_date), "dd MMM yyyy", {
          locale: tr,
        }),
    },
    {
      id: "item_count",
      header: "İçerik",
      cell: ({ row }) => {
        const items = row.original.items || [];
        return (
          <span className="text-sm text-muted-foreground">
            {items.length} Kalem
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Durum",
      cell: ({ row }) => {
        const status = row.original.status;
        const config = STATUS_LABELS[status] || {
          label: status,
          variant: "default",
        };
        return <Badge variant={config.variant}>{config.label}</Badge>;
      },
    },
    {
      id: "delivery",
      header: "Sevk",
      cell: ({ row }) => {
        const items = row.original.items || [];
        const ordered = items.reduce((s, i) => s + Number(i.quantity), 0);
        const delivered = items.reduce((s, i) => s + Number(i.delivered_qty ?? 0), 0);
        return <span className="text-sm tabular-nums text-muted-foreground">%{ordered > 0 ? Math.round((Math.min(delivered, ordered) / ordered) * 100) : 0}</span>;
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const o = row.original;
        const open = (o.items || []).some((i) => Number(i.delivered_qty ?? 0) < Number(i.quantity));
        if (!canShip || o.status === "cancelled" || !open) return null;
        return (
          <Button variant="outline" size="sm" onClick={() => router.push(`/siparisler/sevkiyat/yeni?siparis=${o.id}`)}>
            <Truck className="mr-1.5 h-4 w-4" />
            Sevk et
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canWrite && (
          <Button onClick={() => router.push("/siparisler/yeni")}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Sipariş Ekle
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data}
        searchKey="no"
        searchPlaceholder="Sipariş no ile ara..."
        onDeleteSelected={canWrite ? handleBulkDelete : undefined}
        isDeleting={isDeleting}
      />
    </div>
  );
}
