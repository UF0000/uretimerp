"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Play, Plus, ClipboardPlus, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  startWorkOrder,
  bulkDeleteWorkOrders,
} from "@/app/actions/work-orders";
import { ProductionEntryModal } from "./production-entry-modal";
import { closeWorkOrder, type RawLot } from "@/app/actions/production";
import { formatTR } from "@/lib/format";

import { getErrorMessage } from "@/lib/utils";
import type { WorkOrderRow } from "@/app/actions/work-orders";
import type { ProductRow } from "@/app/actions/master-data/products";
import type { WarehouseRow } from "@/app/actions/master-data/warehouses";
import type { ReasonCodeRow } from "@/app/actions/master-data/reason-codes";
import { usePermission } from "@/components/shared/role-provider";
interface WorkOrderTableProps {
  data: WorkOrderRow[];
  scrapProducts: ProductRow[];
  targetWarehouses: WarehouseRow[];
  reasonCodes: ReasonCodeRow[];
  rawLots: RawLot[];
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
  reasonCodes,
  rawLots,
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

  const handleClose = async (item: WorkOrderRow) => {
    if (!confirm(`${item.no} kapatılacak. Kapatılan iş emrine yeni vardiya girişi yapılamaz. Devam edilsin mi?`)) return;
    try {
      await closeWorkOrder(item.id);
      toast.success("İş emri kapatıldı.");
    } catch (error) {
      toast.error("Kapatılamadı", { description: getErrorMessage(error) });
    }
  };

  const handleOpenCompletion = (item: WorkOrderRow) => {
    setSelectedWorkOrder(item);
    setCompletionModalOpen(true);
  };

  /** İşlem butonları; dar ekranda iş emri no altında da gösterilir (tablo sağa kaymadan erişilsin) */
  const renderActions = (item: WorkOrderRow, align: string) => (
    <div className={`flex flex-wrap items-center gap-2 ${align}`}>
      {item.status === "planned" && (
        <Button size="sm" variant="outline" onClick={() => handleStart(item.id)}>
          <Play className="w-4 h-4 mr-1" /> Başlat
        </Button>
      )}
      {item.status !== "done" && (
        <Button size="sm" onClick={() => handleOpenCompletion(item)}>
          <ClipboardPlus className="w-4 h-4 mr-1" /> Üretim Gir
        </Button>
      )}
      {item.status === "in_progress" && (item.entries?.length ?? 0) > 0 && (
        <Button size="sm" variant="secondary" onClick={() => handleClose(item)}>
          <Lock className="w-4 h-4 mr-1" /> Kapat
        </Button>
      )}
    </div>
  );

  const columns: ColumnDef<WorkOrderRow>[] = [
    {
      accessorKey: "no",
      header: "İş Emri No",
      cell: ({ row }) => (
        <div>
          <span className="font-semibold">{row.original.no}</span>
          {canWrite && row.original.status !== "done" && (
            <div className="mt-2 sm:hidden">{renderActions(row.original, "justify-start")}</div>
          )}
        </div>
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
      header: "Üretilen / Planlanan",
      cell: ({ row }) => {
        const planned = Number(row.original.planned_qty);
        const entries = row.original.entries ?? [];
        const produced = entries.reduce((s, e) => s + Number(e.produced_qty || 0), 0);
        const downtime = entries.reduce((s, e) => s + Number(e.downtime_min || 0), 0);
        const pct = planned > 0 ? Math.min(100, (produced / planned) * 100) : 0;
        return (
          <div className="min-w-40 space-y-1">
            <div className="font-mono text-sm">
              {formatTR(produced, 0)} / {formatTR(planned, 0)} {row.original.product?.unit}
            </div>
            <progress
              value={pct}
              max={100}
              aria-label="Üretim ilerlemesi"
              className="h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary"
            />
            {entries.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {entries.length} vardiya{downtime > 0 ? ` · ${formatTR(downtime, 0)} dk duruş` : ""}
              </div>
            )}
          </div>
        );
      },
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
      cell: ({ row }) => renderActions(row.original, "justify-end"),
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

      <ProductionEntryModal
        isOpen={completionModalOpen}
        onClose={() => {
          setCompletionModalOpen(false);
          setSelectedWorkOrder(null);
        }}
        workOrder={selectedWorkOrder}
        scrapProducts={scrapProducts}
        targetWarehouses={targetWarehouses}
        scrapReasons={reasonCodes.filter((r) => r.kind === "scrap" && r.active)}
        downtimeReasons={reasonCodes.filter((r) => r.kind === "downtime" && r.active)}
        rawLots={rawLots}
      />
    </div>
  );
}
