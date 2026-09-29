"use client";

import { useState, useRef } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Edit2, Trash2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineFormValues, MoldFormInput } from "@/lib/validations/master-data";
import type { Tables } from "@/lib/supabase/database.types";
import {
  deleteLine,
  deleteMold,
  bulkImportMolds,
  bulkDeleteMolds,
  bulkDeleteLines,
} from "@/app/actions/master-data/equipment";
import { LineForm } from "./line-form";
import { MoldForm } from "./mold-form";

import { getErrorMessage } from "@/lib/utils";
import { usePermission } from "@/components/shared/role-provider";
import { formatTR } from "@/lib/format";
import { MOLD_MODE_LABELS, asMoldMode } from "@/lib/product-meta";
const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  maintenance: "Bakımda",
  down: "Arızalı",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  maintenance: "secondary",
  down: "destructive",
};

interface EquipmentTabProps {
  lines: (LineFormValues & { current_capacity_kg_per_hour: number | null })[];
  molds: (Tables<"molds"> & { product: { name: string } | null })[];
  products: Tables<"products">[];
}

export function EquipmentTab({ lines, molds, products }: EquipmentTabProps) {
  const canWrite = usePermission("master-data:write");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Line State
  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<LineFormValues | undefined>(
    undefined,
  );
  const [isDeletingLines, setIsDeletingLines] = useState(false);

  // Mold State
  const [moldFormOpen, setMoldFormOpen] = useState(false);
  const [editingMold, setEditingMold] = useState<MoldFormInput | undefined>(
    undefined,
  );

  const handleImportMolds = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      toast.loading("Kalıplar içe aktarılıyor...", { id: "import-molds" });

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Clean payload for server action
      const cleanData = JSON.parse(JSON.stringify(jsonData));

      const count = await bulkImportMolds(cleanData);

      toast.success(`${count} adet kalıp başarıyla içe aktarıldı!`, {
        id: "import-molds",
      });
    } catch (error) {
      toast.error("İçe aktarım başarısız oldu.", {
        id: "import-molds",
        description: getErrorMessage(error),
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // --- Line Handlers ---
  const handleLineDelete = async (id: string) => {
    if (confirm("Bu hattı silmek istediğinize emin misiniz?")) {
      try {
        await deleteLine(id);
        toast.success("Hat başarıyla silindi.");
      } catch (error) {
        toast.error("Silme başarısız", { description: getErrorMessage(error) });
      }
    }
  };

  const handleBulkDeleteLines = async (ids: string[]) => {
    try {
      setIsDeletingLines(true);
      toast.loading("Hatlar siliniyor...", { id: "bulk-delete-lines" });
      await bulkDeleteLines(ids);
      toast.success(`${ids.length} adet hat başarıyla silindi.`, {
        id: "bulk-delete-lines",
      });
    } catch (error) {
      toast.error("Toplu silme başarısız", {
        id: "bulk-delete-lines",
        description: getErrorMessage(error),
      });
    } finally {
      setIsDeletingLines(false);
    }
  };

  const lineColumns: ColumnDef<EquipmentTabProps["lines"][number]>[] = [
    {
      accessorKey: "code",
      header: "Hat Kodu",
      cell: ({ row }) => (
        <span className="font-semibold">{row.getValue("code")}</span>
      ),
    },
    { accessorKey: "name", header: "Hat Adı" },
    { accessorKey: "head_type", header: "Kafa Tipi" },
    {
      accessorKey: "line_type",
      header: "Tür",
      cell: ({ row }) => (row.original.line_type === "injection" ? "Enjeksiyon" : row.original.line_type === "extrusion" ? "Ekstrüder" : "-"),
    },
    {
      accessorKey: "current_capacity_kg_per_hour",
      header: "Kapasite (bugün)",
      cell: ({ row }) => (row.original.current_capacity_kg_per_hour ? `${formatTR(row.original.current_capacity_kg_per_hour, 0)} kg/sa` : <span className="text-muted-foreground">girilmemiş</span>),
    },
    {
      accessorKey: "status",
      header: "Durum",
      cell: ({ row }) => {
        const s = row.getValue("status") as string;
        return (
          <Badge variant={STATUS_VARIANTS[s] || "default"}>
            {STATUS_LABELS[s] || s}
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditingLine(item);
                setLineFormOpen(true);
              }}
            >
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => item.id && handleLineDelete(item.id)}
            >
              <Trash2 className="w-4 h-4 text-danger" />
            </Button>
          </div>
        );
      },
    },
  ];

  // --- Mold Handlers ---
  const [isDeletingMolds, setIsDeletingMolds] = useState(false);

  const handleMoldDelete = async (id: string) => {
    if (confirm("Bu kalıbı silmek istediğinize emin misiniz?")) {
      try {
        await deleteMold(id);
        toast.success("Kalıp başarıyla silindi.");
      } catch (error) {
        toast.error("Silme başarısız", { description: getErrorMessage(error) });
      }
    }
  };

  const handleBulkDeleteMolds = async (ids: string[]) => {
    try {
      setIsDeletingMolds(true);
      toast.loading("Kalıplar siliniyor...", { id: "bulk-delete-molds" });
      await bulkDeleteMolds(ids);
      toast.success(`${ids.length} adet kalıp başarıyla silindi.`, {
        id: "bulk-delete-molds",
      });
    } catch (error) {
      toast.error("Toplu silme başarısız", {
        id: "bulk-delete-molds",
        description: getErrorMessage(error),
      });
    } finally {
      setIsDeletingMolds(false);
    }
  };

  const moldColumns: ColumnDef<EquipmentTabProps["molds"][number]>[] = [
    {
      accessorKey: "code",
      header: "Kalıp Kodu",
      cell: ({ row }) => (
        <span className="font-semibold">{row.getValue("code")}</span>
      ),
    },
    { accessorKey: "name", header: "Kalıp Adı" },
    {
      accessorKey: "product.name",
      header: "Bağlı Ürün",
      cell: ({ row }) => row.original.product?.name || "-",
    },
    { accessorKey: "cavity_count", header: "Göz Sayısı" },
    { accessorKey: "cycle_time_sec", header: "Çevrim (Sn)" },
    {
      accessorKey: "operation_mode",
      header: "Çalışma",
      cell: ({ row }) => {
        const mode = asMoldMode(row.original.operation_mode);
        return mode ? MOLD_MODE_LABELS[mode] : "—";
      },
    },
    {
      accessorKey: "status",
      header: "Durum",
      cell: ({ row }) => {
        const s = row.getValue("status") as string;
        return (
          <Badge variant={STATUS_VARIANTS[s] || "default"}>
            {STATUS_LABELS[s] || s}
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditingMold({ ...item, operation_mode: asMoldMode(item.operation_mode) });
                setMoldFormOpen(true);
              }}
            >
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => item.id && handleMoldDelete(item.id)}
            >
              <Trash2 className="w-4 h-4 text-danger" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-12">
      {/* Hatlar */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium tracking-tight">
              Üretim Hatları
            </h2>
            <p className="text-sm text-muted-foreground">
              Extruder, enjeksiyon veya montaj hatları
            </p>
          </div>
          {canWrite && (
            <Button
              onClick={() => {
                setEditingLine(undefined);
                setLineFormOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Yeni Hat Ekle
            </Button>
          )}
        </div>
        <DataTable
          columns={
            canWrite
              ? lineColumns
              : lineColumns.filter((c) => c.id !== "actions")
          }
          data={lines}
          searchKey="name"
          searchPlaceholder="Hat ara..."
          onDeleteSelected={canWrite ? handleBulkDeleteLines : undefined}
          isDeleting={isDeletingLines}
        />
      </div>

      {/* Kalıplar */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium tracking-tight">Kalıplar</h2>
            <p className="text-sm text-muted-foreground">
              Üretimde kullanılan kalıplar ve çevrim bilgileri
            </p>
          </div>
          {canWrite && (
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImportMolds}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                <Upload className="w-4 h-4 mr-2" />
                Excel&apos;den İçe Aktar
              </Button>
              <Button
                onClick={() => {
                  setEditingMold(undefined);
                  setMoldFormOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Yeni Kalıp Ekle
              </Button>
            </div>
          )}
        </div>
        <DataTable
          columns={
            canWrite
              ? moldColumns
              : moldColumns.filter((c) => c.id !== "actions")
          }
          data={molds}
          searchKey="name"
          searchPlaceholder="Kalıp ara..."
          onDeleteSelected={canWrite ? handleBulkDeleteMolds : undefined}
          isDeleting={isDeletingMolds}
        />
      </div>

      {/* Formlar */}
      {lineFormOpen && (
        <LineForm
          open={lineFormOpen}
          onOpenChange={setLineFormOpen}
          initialData={editingLine}
        />
      )}
      {moldFormOpen && (
        <MoldForm
          open={moldFormOpen}
          onOpenChange={setMoldFormOpen}
          initialData={editingMold}
          products={products}
        />
      )}
    </div>
  );
}
