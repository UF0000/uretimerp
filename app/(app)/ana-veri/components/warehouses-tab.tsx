"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WarehouseFormValues } from "@/lib/validations/master-data";
import { deleteWarehouse, bulkDeleteWarehouses } from "@/app/actions/master-data/warehouses";
import { WarehouseForm } from "./warehouse-form";

import { getErrorMessage } from "@/lib/utils";
const TYPE_LABELS: Record<string, string> = {
  raw: "Hammadde",
  finished: "Mamul",
  regrind: "Regrind",
  scrap: "Hurda",
  quarantine: "Karantina",
};

const TYPE_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  finished: "default",
  raw: "secondary",
  regrind: "outline",
  quarantine: "destructive",
  scrap: "destructive",
};

interface WarehousesTabProps {
  data: WarehouseFormValues[];
}

export function WarehousesTab({ data }: WarehousesTabProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseFormValues | undefined>(undefined);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = (warehouse: WarehouseFormValues) => {
    setEditingWarehouse(warehouse);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingWarehouse(undefined);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Bu depoyu silmek istediğinize emin misiniz? (Bağlı stok hareketi varsa silinemez)")) {
      try {
        await deleteWarehouse(id);
        toast.success("Depo başarıyla silindi.");
      } catch (error) {
        toast.error("Silme başarısız", { description: getErrorMessage(error) });
      }
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      setIsDeleting(true);
      toast.loading("Depolar siliniyor...", { id: "bulk-delete-warehouses" });
      await bulkDeleteWarehouses(ids);
      toast.success(`${ids.length} adet depo başarıyla silindi.`, { id: "bulk-delete-warehouses" });
    } catch (error) {
      toast.error("Toplu silme başarısız", { id: "bulk-delete-warehouses", description: getErrorMessage(error) });
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: ColumnDef<WarehouseFormValues>[] = [
    {
      accessorKey: "name",
      header: "Depo Adı",
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "type",
      header: "Depo Tipi",
      cell: ({ row }) => {
        const t = row.getValue("type") as string;
        return (
          <Badge variant={TYPE_VARIANTS[t] || "default"}>
            {TYPE_LABELS[t] || t}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "İşlemler",
      cell: ({ row }) => {
        const warehouse = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="icon" onClick={() => handleEdit(warehouse)}>
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => warehouse.id && handleDelete(warehouse.id)}>
              <Trash2 className="w-4 h-4 text-danger" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium tracking-tight">Depolar</h2>
          <p className="text-sm text-muted-foreground">
            Stok hareketlerinin izlendiği lokasyon tanımlamaları
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Ekle
        </Button>
      </div>

      <DataTable 
        columns={columns} 
        data={data} 
        searchKey="name" 
        searchPlaceholder="Depo ara..." 
        onDeleteSelected={handleBulkDelete}
        isDeleting={isDeleting}
      />

      {formOpen && (
        <WarehouseForm 
          open={formOpen} 
          onOpenChange={setFormOpen} 
          initialData={editingWarehouse} 
        />
      )}
    </div>
  );
}
