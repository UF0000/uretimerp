"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReasonCodeFormValues } from "@/lib/validations/master-data";
import { deleteReasonCode, bulkDeleteReasonCodes } from "@/app/actions/master-data/reason-codes";
import { ReasonCodeForm } from "./reason-code-form";

import { getErrorMessage } from "@/lib/utils";
const KIND_LABELS: Record<string, string> = {
  downtime: "Duruş",
  scrap: "Fire",
};

interface ReasonCodesTabProps {
  data: ReasonCodeFormValues[];
}

export function ReasonCodesTab({ data }: ReasonCodesTabProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<ReasonCodeFormValues | undefined>(undefined);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = (code: ReasonCodeFormValues) => {
    setEditingCode(code);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingCode(undefined);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Bu kodu silmek istediğinize emin misiniz?")) {
      try {
        await deleteReasonCode(id);
        toast.success("Kod başarıyla silindi.");
      } catch (error) {
        toast.error("Silme başarısız", { description: getErrorMessage(error) });
      }
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      setIsDeleting(true);
      toast.loading("Kodlar siliniyor...", { id: "bulk-delete-reason-codes" });
      await bulkDeleteReasonCodes(ids);
      toast.success(`${ids.length} adet kod başarıyla silindi.`, { id: "bulk-delete-reason-codes" });
    } catch (error) {
      toast.error("Toplu silme başarısız", { id: "bulk-delete-reason-codes", description: getErrorMessage(error) });
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: ColumnDef<ReasonCodeFormValues>[] = [
    {
      accessorKey: "kind",
      header: "Tip",
      cell: ({ row }) => {
        const k = row.getValue("kind") as string;
        return (
          <Badge variant={k === "downtime" ? "secondary" : "destructive"}>
            {KIND_LABELS[k] || k}
          </Badge>
        );
      },
    },
    {
      accessorKey: "code",
      header: "Kod",
      cell: ({ row }) => <span className="font-semibold">{row.getValue("code")}</span>,
    },
    {
      accessorKey: "label",
      header: "Açıklama",
    },
    {
      id: "actions",
      header: "İşlemler",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => item.id && handleDelete(item.id)}>
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
          <h2 className="text-lg font-medium tracking-tight">Neden Kodları</h2>
          <p className="text-sm text-muted-foreground">
            Üretim duruş ve fire sebepleri
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
        searchKey="label" 
        searchPlaceholder="Açıklama ara..." 
        onDeleteSelected={handleBulkDelete}
        isDeleting={isDeleting}
      />

      {formOpen && (
        <ReasonCodeForm 
          open={formOpen} 
          onOpenChange={setFormOpen} 
          initialData={editingCode} 
        />
      )}
    </div>
  );
}
