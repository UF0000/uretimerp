"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Plus, Edit2, Trash2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteBom,
  bulkDeleteBoms,
  hardDeleteBom,
  hardBulkDeleteBoms,
  restoreBom,
} from "@/app/actions/bom";

import { getErrorMessage } from "@/lib/utils";
import type { BomRow } from "@/app/actions/bom";
import { usePermission } from "@/components/shared/role-provider";
const TYPE_LABELS: Record<string, string> = {
  extrusion: "Ekstrüzyon",
  injection: "Enjeksiyon",
};

interface BomTableProps {
  data: BomRow[];
}

export function BomTable({ data }: BomTableProps) {
  const canWrite = usePermission("master-data:write");
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

  const activeBoms = data.filter((b) => b.active === true);
  const passiveBoms = data.filter((b) => b.active === false);

  const handleDelete = async (item: BomRow) => {
    if (item.active) {
      if (confirm("Bu reçeteyi pasife almak istediğinize emin misiniz?")) {
        try {
          await deleteBom(item.id);
          toast.success("Reçete pasife alındı.");
        } catch (error) {
          toast.error("İşlem başarısız", {
            description: getErrorMessage(error),
          });
        }
      }
    } else {
      if (
        confirm(
          "Bu reçeteyi KALICI OLARAK silmek istediğinize emin misiniz? Bu işlem geri alınamaz!",
        )
      ) {
        try {
          await hardDeleteBom(item.id);
          toast.success("Reçete kalıcı olarak silindi.");
        } catch (error) {
          toast.error("Silme başarısız", {
            description: getErrorMessage(error),
          });
        }
      }
    }
  };

  const handleRestore = async (id: string) => {
    if (
      confirm("Bu reçeteyi tekrar aktifleştirmek istediğinize emin misiniz?")
    ) {
      try {
        await restoreBom(id);
        toast.success("Reçete aktifleştirildi.");
      } catch (error) {
        toast.error("İşlem başarısız", { description: getErrorMessage(error) });
      }
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (activeTab === "active") {
      if (
        confirm(
          `Seçili ${ids.length} reçeteyi pasife almak istediğinize emin misiniz?`,
        )
      ) {
        try {
          setIsDeleting(true);
          toast.loading("Reçeteler pasife alınıyor...", {
            id: "bulk-delete-boms",
          });
          await bulkDeleteBoms(ids);
          toast.success(`${ids.length} adet reçete başarıyla pasife alındı.`, {
            id: "bulk-delete-boms",
          });
        } catch (error) {
          toast.error("Toplu işlem başarısız", {
            id: "bulk-delete-boms",
            description: getErrorMessage(error),
          });
        } finally {
          setIsDeleting(false);
        }
      }
    } else {
      if (
        confirm(
          `Seçili ${ids.length} reçeteyi KALICI OLARAK silmek istediğinize emin misiniz?`,
        )
      ) {
        try {
          setIsDeleting(true);
          toast.loading("Reçeteler kalıcı olarak siliniyor...", {
            id: "bulk-delete-boms",
          });
          await hardBulkDeleteBoms(ids);
          toast.success(`${ids.length} adet reçete kalıcı olarak silindi.`, {
            id: "bulk-delete-boms",
          });
        } catch (error) {
          toast.error("Toplu silme başarısız", {
            id: "bulk-delete-boms",
            description: getErrorMessage(error),
          });
        } finally {
          setIsDeleting(false);
        }
      }
    }
  };

  const columns: ColumnDef<BomRow>[] = [
    {
      id: "recipe",
      // Arama: reçete kodu, adı ve ürün kodu/adı birlikte
      accessorFn: (b) => `${b.code} ${b.name} ${b.product?.code ?? ""} ${b.product?.name ?? ""}`,
      header: "Reçete",
      cell: ({ row }) => (
        <div>
          <div className="font-semibold">
            {row.original.code} <span className="font-normal text-muted-foreground">v{row.original.version}</span>
          </div>
          <div className="text-sm">{row.original.name}</div>
        </div>
      ),
    },
    {
      id: "product",
      header: "Ürün",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.product?.code}</div>
          <div className="text-xs text-muted-foreground">{row.original.product?.name}</div>
        </div>
      ),
    },
    {
      accessorKey: "production_type",
      header: "Üretim Tipi",
      cell: ({ row }) => {
        const t = row.getValue("production_type") as string;
        return (
          <Badge variant={t === "extrusion" ? "default" : "secondary"}>
            {TYPE_LABELS[t] || t}
          </Badge>
        );
      },
    },
    {
      accessorKey: "active",
      header: "Durum",
      cell: ({ row }) => {
        const active = row.getValue("active") as boolean;
        return (
          <Badge variant={active ? "outline" : "destructive"}>
            {active ? "Aktif" : "Pasif"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "İşlemler",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            {!item.active && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRestore(item.id)}
                title="Geri Yükle"
              >
                <RefreshCcw className="w-4 h-4 text-success" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/recete/${item.id}`)}
              title="Düzenle"
            >
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(item)}
              title={item.active ? "Pasife Al" : "Kalıcı Olarak Sil"}
            >
              <Trash2 className="w-4 h-4 text-danger" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium tracking-tight">
            Kayıtlı Reçeteler
          </h2>
          <p className="text-sm text-muted-foreground">
            Sistemde tanımlı tüm ürün reçeteleri
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => router.push("/recete/yeni")}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Reçete Ekle
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-sm mb-4">
          <TabsTrigger value="active">
            Aktif Reçeteler
            <Badge variant="secondary" className="ml-2 bg-background/50">
              {activeBoms.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="passive">
            Pasif Reçeteler
            <Badge variant="secondary" className="ml-2 bg-background/50">
              {passiveBoms.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="m-0">
          <DataTable
            columns={
              canWrite ? columns : columns.filter((c) => c.id !== "actions")
            }
            data={activeBoms}
            searchKey="recipe"
            searchPlaceholder="Reçete kodu, adı veya ürün ara..."
            onDeleteSelected={canWrite ? handleBulkDelete : undefined}
            isDeleting={isDeleting}
          />
        </TabsContent>

        <TabsContent value="passive" className="m-0">
          <DataTable
            columns={
              canWrite ? columns : columns.filter((c) => c.id !== "actions")
            }
            data={passiveBoms}
            searchKey="recipe"
            searchPlaceholder="Reçete kodu, adı veya ürün ara..."
            onDeleteSelected={canWrite ? handleBulkDelete : undefined}
            isDeleting={isDeleting}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
