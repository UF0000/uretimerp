"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PartnerFormValues } from "@/lib/validations/master-data";
import {
  deletePartner,
  bulkDeletePartners,
} from "@/app/actions/master-data/partners";
import { PartnerForm } from "./partner-form";

import { getErrorMessage } from "@/lib/utils";
import { usePermission } from "@/components/shared/role-provider";
const TYPE_LABELS: Record<string, string> = {
  customer: "Müşteri",
  supplier: "Tedarikçi",
};

interface PartnersTabProps {
  data: PartnerFormValues[];
}

export function PartnersTab({ data }: PartnersTabProps) {
  const canWrite = usePermission("master-data:write");
  const [formOpen, setFormOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<
    PartnerFormValues | undefined
  >(undefined);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = (partner: PartnerFormValues) => {
    setEditingPartner(partner);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingPartner(undefined);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Bu cariyi silmek istediğinize emin misiniz?")) {
      try {
        await deletePartner(id);
        toast.success("Cari başarıyla silindi.");
      } catch (error) {
        toast.error("Silme başarısız", { description: getErrorMessage(error) });
      }
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      setIsDeleting(true);
      toast.loading("Cariler siliniyor...", { id: "bulk-delete-partners" });
      await bulkDeletePartners(ids);
      toast.success(`${ids.length} adet cari başarıyla silindi.`, {
        id: "bulk-delete-partners",
      });
    } catch (error) {
      toast.error("Toplu silme başarısız", {
        id: "bulk-delete-partners",
        description: getErrorMessage(error),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: ColumnDef<PartnerFormValues>[] = [
    {
      accessorKey: "name",
      header: "Cari Unvan",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("name")}</span>
      ),
    },
    {
      accessorKey: "type",
      header: "Tip",
      cell: ({ row }) => {
        const t = row.getValue("type") as string;
        return (
          <Badge variant={t === "customer" ? "default" : "secondary"}>
            {TYPE_LABELS[t] || t}
          </Badge>
        );
      },
    },
    {
      accessorKey: "phone",
      header: "Telefon",
    },
    {
      accessorKey: "address",
      header: "Adres",
    },
    {
      id: "actions",
      header: "İşlemler",
      cell: ({ row }) => {
        const partner = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(partner)}
            >
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => partner.id && handleDelete(partner.id)}
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium tracking-tight">Cariler</h2>
          <p className="text-sm text-muted-foreground">
            Müşteri ve tedarikçi tanımlamaları
          </p>
        </div>
        {canWrite && (
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Ekle
          </Button>
        )}
      </div>

      <DataTable
        columns={canWrite ? columns : columns.filter((c) => c.id !== "actions")}
        data={data}
        searchKey="name"
        searchPlaceholder="Cari ara..."
        onDeleteSelected={canWrite ? handleBulkDelete : undefined}
        isDeleting={isDeleting}
      />

      {formOpen && (
        <PartnerForm
          open={formOpen}
          onOpenChange={setFormOpen}
          initialData={editingPartner}
        />
      )}
    </div>
  );
}
