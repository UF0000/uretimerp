"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { ReasonCodeFormValues } from "@/lib/validations/master-data";
import { deleteReasonCode, bulkDeleteReasonCodes } from "@/app/actions/master-data/reason-codes";
import { ReasonCodeForm } from "./reason-code-form";
import { cn, getErrorMessage } from "@/lib/utils";
import { usePermission } from "@/components/shared/role-provider";

type Kind = ReasonCodeFormValues["kind"];

const KINDS: { kind: Kind; title: string; description: string; accent: string }[] = [
  { kind: "scrap", title: "Fire nedenleri", description: "Vardiya girişinde fire için seçilir", accent: "border-t-danger" },
  { kind: "downtime", title: "Duruş nedenleri", description: "Vardiya girişinde duruş için seçilir", accent: "border-t-warning" },
];

interface ReasonCodesTabProps {
  data: ReasonCodeFormValues[];
}

export function ReasonCodesTab({ data }: ReasonCodesTabProps) {
  const canWrite = usePermission("master-data:write");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<ReasonCodeFormValues | undefined>(undefined);
  const [newKind, setNewKind] = useState<Kind>("scrap");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = (code: ReasonCodeFormValues) => {
    setEditingCode(code);
    setFormOpen(true);
  };

  const handleAdd = (kind: Kind) => {
    setEditingCode(undefined);
    setNewKind(kind);
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
      accessorKey: "code",
      header: "Kod",
      cell: ({ row }) => <span className="font-semibold">{row.original.code}</span>,
    },
    { accessorKey: "label", header: "Açıklama" },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} aria-label="Düzenle">
              <Edit2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => item.id && handleDelete(item.id)} aria-label="Sil">
              <Trash2 className="h-4 w-4 text-danger" />
            </Button>
          </div>
        );
      },
    },
  ];
  const visibleColumns = canWrite ? columns : columns.filter((c) => c.id !== "actions");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium tracking-tight">Neden Kodları</h2>
        <p className="text-sm text-muted-foreground">Üretim girişinde seçilen fire ve duruş sebepleri</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {KINDS.map(({ kind, title, description, accent }) => {
          const rows = data.filter((d) => d.kind === kind);
          return (
            <section key={kind} className={cn("space-y-3 rounded-md border border-t-4 border-border p-4", accent)}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">
                    {title} <span className="font-normal text-muted-foreground">({rows.length})</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                {canWrite && (
                  <Button size="sm" onClick={() => handleAdd(kind)}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Yeni {kind === "scrap" ? "fire" : "duruş"} nedeni
                  </Button>
                )}
              </div>
              <DataTable
                storageKey={`reason-codes-${kind}`}
                columns={visibleColumns}
                data={rows}
                searchKey="label"
                searchPlaceholder="Açıklama ara..."
                onDeleteSelected={canWrite ? handleBulkDelete : undefined}
                isDeleting={isDeleting}
              />
            </section>
          );
        })}
      </div>

      {formOpen && <ReasonCodeForm open={formOpen} onOpenChange={setFormOpen} initialData={editingCode} defaultKind={newKind} />}
    </div>
  );
}
