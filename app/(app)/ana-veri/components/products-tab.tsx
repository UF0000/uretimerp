"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  deleteProduct,
  bulkImportProducts,
  bulkDeleteProducts,
} from "@/app/actions/master-data/products";
import { ProductFormInput } from "@/lib/validations/master-data";
import type { ExcelRow } from "@/lib/excel";
import type { Tables } from "@/lib/supabase/database.types";
import { ProductForm } from "./product-form";
import { ExcelImportButton } from "./excel-import-button";

import { getErrorMessage } from "@/lib/utils";
import { usePermission } from "@/components/shared/role-provider";
// Tip eşleştirmeleri
const TYPE_LABELS: Record<string, string> = {
  finished: "Mamul",
  raw: "Hammadde",
  semi: "Yarı Mamul",
  regrind: "Regrind",
  scrap: "Hurda",
};

const TYPE_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  finished: "default",
  raw: "secondary",
  regrind: "outline",
  scrap: "destructive",
  semi: "secondary",
};

interface ProductsTabProps {
  data: Tables<"products">[];
}

export function ProductsTab({ data }: ProductsTabProps) {
  const canWrite = usePermission("master-data:write");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<
    ProductFormInput | undefined
  >(undefined);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = (product: Tables<"products">) => {
    setEditingProduct({
      ...product,
      unit_cost: product.unit_cost ?? 0,
      currency: product.currency ?? "TRY",
    });
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingProduct(undefined);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Bu ürünü silmek (pasife almak) istediğinize emin misiniz?")) {
      try {
        await deleteProduct(id);
        toast.success("Ürün başarıyla silindi.");
      } catch (error) {
        toast.error("Silme başarısız", { description: getErrorMessage(error) });
      }
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      setIsDeleting(true);
      toast.loading("Ürünler siliniyor...", { id: "bulk-delete-products" });
      await bulkDeleteProducts(ids);
      toast.success(`${ids.length} adet ürün başarıyla silindi.`, {
        id: "bulk-delete-products",
      });
    } catch (error) {
      toast.error("Toplu silme başarısız", {
        id: "bulk-delete-products",
        description: getErrorMessage(error),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImport = async (excelData: ExcelRow[]) => {
    // Next.js Server Actions gereği saf (plain) obje gönderilmeli
    const cleanData = JSON.parse(JSON.stringify(excelData));
    return await bulkImportProducts(cleanData);
  };

  const sampleFormat = `Kodu\tAdi\tTipi\tBirimi\tKategori\tMalzemeSinifi\tMinStok\tKritikStok\tBirimMaliyet
H-01\tPP Hammadde\traw\tkg\tPlastik\tA-Grade\t1000\t500\t25.5
M-01\t100 lük Boru\tfinished\tmetre\tBoru\t\t100\t20\t0
F-01\tBoru Firesi\tscrap\tkg\tFire\t\t0\t0\t0`;

  const columns: ColumnDef<Tables<"products">>[] = [
    {
      accessorKey: "code",
      header: "Kod",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("code")}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "Ürün Adı",
    },
    {
      accessorKey: "type",
      header: "Tip",
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
      accessorKey: "unit",
      header: "Birim",
    },
    {
      accessorKey: "category",
      header: "Kategori",
      cell: ({ row }) => {
        const cat = row.getValue("category") as string;
        if (!cat) return "-";
        const catMap: Record<string, string> = {
          baglanti_parcasi: "Bağlantı Parçası",
          boru: "Boru",
          hammadde: "Hammadde",
          sarf_malzeme: "Sarf Malzeme",
          ambalaj: "Ambalaj / Paketleme",
          yedek_parca: "Yedek Parça",
          diger: "Diğer",
        };
        return catMap[cat] || cat;
      },
    },
    {
      accessorKey: "material_grade",
      header: "Grade",
    },
    {
      accessorKey: "unit_cost",
      header: "Birim Maliyet",
      cell: ({ row }) => {
        const cost = row.original.unit_cost || 0;
        const cur = row.original.currency || "TRY";
        const symbol = cur === "USD" ? "$" : cur === "EUR" ? "€" : "₺";
        return (
          <span className="font-semibold text-primary">
            {cost.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}{" "}
            {symbol}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "İşlemler",
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(product)}
            >
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => product.id && handleDelete(product.id)}
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
          <h2 className="text-lg font-medium tracking-tight">
            Ürünler ve Hammaddeler
          </h2>
          <p className="text-sm text-muted-foreground">
            Sistemdeki tüm tanımlı materyaller
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <ExcelImportButton
              onImport={handleImport}
              sampleFormat={sampleFormat}
            />
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Yeni Ekle
            </Button>
          </div>
        )}
      </div>

      <DataTable
        columns={canWrite ? columns : columns.filter((c) => c.id !== "actions")}
        data={data}
        searchKey="name"
        searchPlaceholder="Ürün adı ile ara..."
        onDeleteSelected={canWrite ? handleBulkDelete : undefined}
        isDeleting={isDeleting}
      />

      {formOpen && (
        <ProductForm
          open={formOpen}
          onOpenChange={setFormOpen}
          initialData={editingProduct}
        />
      )}
    </div>
  );
}
