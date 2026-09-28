"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Play, Plus, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  startWorkOrder,
  bulkDeleteWorkOrders,
} from "@/app/actions/work-orders";
import { ProductionCompletionModal } from "./production-completion-modal";

import { getErrorMessage } from "@/lib/utils";
import type { WorkOrderRow } from "@/app/actions/work-orders";
import type { ProductRow } from "@/app/actions/master-data/products";
import type { WarehouseRow } from "@/app/actions/master-data/warehouses";
import { usePermission } from "@/components/shared/role-provider";
interface WorkOrderTableProps {
  data: WorkOrderRow[];
  scrapProducts: ProductRow[];
  targetWarehouses: WarehouseRow[];
}

const STATUS_LABELS: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  planned: { label: "Planlandı", variant: "secondary" },
  in_progress: { label: "Üretimde", variant: "default" },
  done: { label: "Tamamlandı", variant: "outline" },
};

export function WorkOrderTable({
  data,
  scrapProducts,
  targetWarehouses,
}: WorkOrderTableProps) {
  const canWrite = usePermission("production:write");
  const router = useRouter();
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] =
    useState<WorkOrderRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleStart = async (id: string) => {
    try {
      await startWorkOrder(id);
      toast.success("İş emri başlatıldı.");
    } catch (error) {
      toast.error("Hata", { description: getErrorMessage(error) });
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (
      confirm(
        `Seçili ${ids.length} iş emrini silmek istediğinize emin misiniz?`,
      )
    ) {
      try {
        setIsDeleting(true);
        toast.loading("İş emirleri siliniyor...", { id: "bulk-delete-wo" });
        await bulkDeleteWorkOrders(ids);
        toast.success(`${ids.length} adet iş emri başarıyla silindi.`, {
          id: "bulk-delete-wo",
        });
      } catch (error) {
        toast.error("Toplu silme başarısız", {
          id: "bulk-delete-wo",
          description: getErrorMessage(error),
        });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleOpenCompletion = (item: WorkOrderRow) => {
    setSelectedWorkOrder(item);
    setCompletionModalOpen(true);
  };

  const columns: ColumnDef<WorkOrderRow>[] = [
    {
      accessorKey: "no",
      header: "İş Emri No",
      cell: ({ row }) => (
        <span className="font-semibold">{row.original.no}</span>
      ),
    },
    {
      accessorKey: "product.code",
      header: "Üretilecek Ürün",
      cell: ({ row }) => (
        <div>
          <div className="font-semibold">{row.original.product?.code}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.product?.name}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "planned_qty",
      header: "Planlanan",
      cell: ({ row }) => (
        <span className="font-mono">
          {Number(row.original.planned_qty).toLocaleString("tr-TR")}{" "}
          {row.original.product?.unit}
        </span>
      ),
    },
    {
      id: "machine",
      header: "Hat / Kalıp",
      cell: ({ row }) => {
        const line = row.original.line?.name;
        const mold = row.original.mold?.name;
        if (line) return <span className="text-sm">{line}</span>;
        if (mold) return <span className="text-sm">{mold}</span>;
        return <span className="text-sm text-muted-foreground">-</span>;
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
      id: "actions",
      header: "İşlemler",
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div className="flex items-center justify-end gap-2">
            {item.status === "planned" && (
              <Button size="sm" onClick={() => handleStart(item.id)}>
                <Play className="w-4 h-4 mr-1" /> Başlat
              </Button>
            )}
            {item.status === "in_progress" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleOpenCompletion(item)}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" /> Bitir
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canWrite && (
          <Button onClick={() => router.push("/uretim/is-emirleri/yeni")}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni İş Emri Oluştur
          </Button>
        )}
      </div>

      <DataTable
        columns={canWrite ? columns : columns.filter((c) => c.id !== "actions")}
        data={data}
        searchKey="no"
        searchPlaceholder="İş emri no ile ara..."
        onDeleteSelected={canWrite ? handleBulkDelete : undefined}
        isDeleting={isDeleting}
      />

      <ProductionCompletionModal
        isOpen={completionModalOpen}
        onClose={() => {
          setCompletionModalOpen(false);
          setSelectedWorkOrder(null);
        }}
        workOrder={selectedWorkOrder}
        scrapProducts={scrapProducts}
        targetWarehouses={targetWarehouses}
      />
    </div>
  );
}
