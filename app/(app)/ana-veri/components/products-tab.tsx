"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { ArchiveRestore, Edit2, Eye, ImageOff, ListChecks, Plus, RotateCcw, Search, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { MultiSelect } from "@/components/shared/multi-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { deleteProduct, bulkImportProducts, bulkDeleteProducts, restoreProducts } from "@/app/actions/master-data/products";
import { ProductFormInput } from "@/lib/validations/master-data";
import { CATEGORY_LABELS, PRODUCT_TYPE_BADGE, PRODUCT_TYPE_LABELS, PRODUCT_TYPES, categoryLabel, compareByGroup, type ProductType } from "@/lib/product-meta";
import type { ExcelRow } from "@/lib/excel";
import type { Tables } from "@/lib/supabase/database.types";
import { formatTR } from "@/lib/format";
import { inSelection, matchesTokens, searchTokens } from "@/lib/search";
import { ProductForm } from "./product-form";
import { ExcelImportButton } from "./excel-import-button";
import { BulkUpdateDialog } from "./bulk-update-dialog";
import { getErrorMessage } from "@/lib/utils";
import { usePermission } from "@/components/shared/role-provider";

type Product = Tables<"products">;

interface ProductsTabProps {
  data: Product[];
  /** Silinen (pasif) ürünler: "Silinen ürünler" görünümünden geri alınır */
  deleted: Product[];
  groups: { code: string; name: string }[];
}

const ALL = "";

export function ProductsTab({ data: activeProducts, deleted, groups }: ProductsTabProps) {
  const router = useRouter();
  const canWrite = usePermission("master-data:write");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductFormInput | undefined>(undefined);
  const [isDeleting, setIsDeleting] = useState(false);
  // Toplu özellik güncelleme: seçili ürün id'leri (pencere kapanınca seçim korunur)
  const [bulkIds, setBulkIds] = useState<string[] | null>(null);
  // Silinen ürünler görünümü: liste pasif ürünleri gösterir, seçilenler geri alınır
  const [showDeleted, setShowDeleted] = useState(false);
  const data = showDeleted ? deleted : activeProducts;

  // ── Filtreler ──
  const [q, setQ] = useState("");
  // Çoklu seçim: boş = hepsi
  const [types, setTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [groupCodesSel, setGroupCodesSel] = useState<string[]>([]);
  const [materialGroupsSel, setMaterialGroupsSel] = useState<string[]>([]);
  const [variant, setVariant] = useState(ALL);

  // Grup adları yalnızca filtre seçeneklerinde gösterilir (listede sadece kod)
  const groupName = useMemo(() => new Map(groups.map((g) => [g.code, g.name])), [groups]);
  const distinct = (pick: (p: Product) => string | null) => [...new Set(data.map(pick).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, "tr"));
  const groupCodes = useMemo(() => [...new Set([...groups.map((g) => g.code), ...distinct((p) => p.group_code)])].sort((a, b) => a.localeCompare(b, "tr", { numeric: true })), [data, groups]); // eslint-disable-line react-hooks/exhaustive-deps
  const materialGroups = useMemo(() => distinct((p) => p.material_group), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const tokens = searchTokens(q);
    return data
      .filter(
        (p) =>
          matchesTokens(tokens, p.code, p.name, p.group_code, p.variant_code, p.material_grade, p.material_group, p.description, p.barcode) &&
          inSelection(types, p.type) &&
          inSelection(categories, p.category) &&
          inSelection(groupCodesSel, p.group_code) &&
          inSelection(materialGroupsSel, p.material_group) &&
          (!variant || (variant === "var" ? Boolean(p.variant_code) : !p.variant_code)),
      )
      .sort(compareByGroup);
  }, [data, q, types, categories, groupCodesSel, materialGroupsSel, variant]);
  const anyFilter = Boolean(q || types.length || categories.length || groupCodesSel.length || materialGroupsSel.length || variant);
  const clearFilters = () => {
    setQ("");
    setTypes([]);
    setCategories([]);
    setGroupCodesSel([]);
    setMaterialGroupsSel([]);
    setVariant(ALL);
  };

  const openDetail = (p: Product) => router.push(`/ana-veri/urunler/${p.id}`);

  const handleEdit = (product: Product) => {
    setEditingProduct({ ...product, unit_cost: product.unit_cost ?? 0, currency: product.currency ?? "TRY" });
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
      toast.success(`${ids.length} adet ürün başarıyla silindi.`, { id: "bulk-delete-products" });
    } catch (error) {
      toast.error("Toplu silme başarısız", { id: "bulk-delete-products", description: getErrorMessage(error) });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = async (ids: string[]) => {
    try {
      const n = await restoreProducts(ids);
      toast.success(`${n} ürün geri alındı.`);
      router.refresh();
    } catch (error) {
      toast.error("Geri alma başarısız", { description: getErrorMessage(error) });
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

  const columns: ColumnDef<Product>[] = [
    {
      id: "image",
      header: "Görsel",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.image_url ? (
          <Image src={row.original.image_url} alt={row.original.name} width={36} height={36} unoptimized className="h-9 w-9 rounded border border-border object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded border border-dashed border-border text-muted-foreground" aria-label="Görsel yok">
            <ImageOff className="h-4 w-4" />
          </span>
        ),
    },
    { accessorKey: "code", header: "Stok kodu", cell: ({ row }) => <span className="font-medium">{row.original.code}</span> },
    { accessorKey: "name", header: "Ürün adı" },
    {
      accessorKey: "type",
      header: "Tür",
      cell: ({ row }) => {
        const t = row.original.type as ProductType;
        return <Badge variant={PRODUCT_TYPE_BADGE[t] ?? "default"}>{PRODUCT_TYPE_LABELS[t] ?? t}</Badge>;
      },
    },
    { accessorKey: "category", header: "Aile", cell: ({ row }) => categoryLabel(row.original.category) },
    {
      accessorKey: "group_code",
      header: "Grup",
      cell: ({ row }) => row.original.group_code ?? "—",
    },
    { accessorKey: "variant_code", header: "Genel kod", cell: ({ row }) => row.original.variant_code ?? "—" },
    { accessorKey: "unit", header: "Birim" },
    {
      id: "size",
      header: "Boyut",
      cell: ({ row }) => {
        const p = row.original;
        const parts = [p.diameter_mm && `Ø${formatTR(Number(p.diameter_mm), 0)}`, p.wall_thickness_mm && `${formatTR(Number(p.wall_thickness_mm), 1)} mm`, p.sdr && `SDR ${formatTR(Number(p.sdr), 1)}`].filter(Boolean);
        return parts.length ? parts.join(" · ") : "—";
      },
    },
    {
      accessorKey: "unit_cost",
      header: "Birim fiyat",
      cell: ({ row }) => {
        const cost = row.original.unit_cost || 0;
        const cur = row.original.currency || "TRY";
        const symbol = cur === "USD" ? "$" : cur === "EUR" ? "€" : "₺";
        return (
          <span className="font-semibold tabular-nums text-primary">
            {formatTR(cost)} {symbol}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => openDetail(product)} aria-label="Ayrıntı">
              <Eye className="h-4 w-4 text-muted-foreground" />
            </Button>
            {canWrite && showDeleted && (
              <Button variant="ghost" size="sm" onClick={() => handleRestore([product.id])}>
                <Undo2 className="mr-1 h-4 w-4" />
                Geri al
              </Button>
            )}
            {canWrite && !showDeleted && (
              <>
                <Button variant="ghost" size="icon" onClick={() => handleEdit(product)} aria-label="Düzenle">
                  <Edit2 className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => product.id && handleDelete(product.id)} aria-label="Sil">
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium tracking-tight">{showDeleted ? "Silinen ürünler" : "Ürünler ve Hammaddeler"}</h2>
          <p className="text-sm text-muted-foreground">
            {showDeleted
              ? "Silinen ürünler kaybolmaz, pasif durur · seçip \"Geri al\" ile listeye döndürün"
              : "Ayrıntı için satıra çift tıklayın · sütun kenarlarını sürükleyerek genişliği ayarlayın"}
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button variant={showDeleted ? "default" : "outline"} onClick={() => setShowDeleted((v) => !v)} aria-pressed={showDeleted}>
              <ArchiveRestore className="mr-2 h-4 w-4" />
              {showDeleted ? "Ürünlere dön" : `Silinen ürünler (${deleted.length})`}
            </Button>
            <ExcelImportButton onImport={handleImport} sampleFormat={sampleFormat} />
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Yeni Ekle
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/30 p-3 md:grid-cols-3 xl:grid-cols-7">
        <div className="relative col-span-2 md:col-span-3 xl:col-span-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara: kelimeler ayrı ayrı aranır (ör. henq sdr 6)" className="pl-9" />
        </div>
        <MultiSelect value={types} onValueChange={setTypes} placeholder="Tüm türler" options={PRODUCT_TYPES.map((t) => ({ value: t, label: PRODUCT_TYPE_LABELS[t] }))} />
        <MultiSelect value={categories} onValueChange={setCategories} placeholder="Tüm aileler" options={Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
        <MultiSelect
          value={groupCodesSel}
          onValueChange={setGroupCodesSel}
          placeholder="Tüm grup kodları"
          options={groupCodes.map((c) => ({ value: c, label: groupName.has(c) ? `${c} — ${groupName.get(c)}` : c }))}
        />
        <MultiSelect value={materialGroupsSel} onValueChange={setMaterialGroupsSel} placeholder="Tüm malzeme grupları" options={materialGroups.map((m) => ({ value: m, label: m }))} />
        <div className="flex gap-2">
          <SearchableSelect
            value={variant}
            onValueChange={setVariant}
            placeholder="Varyant: hepsi"
            options={[
              { value: ALL, label: "Varyant: hepsi" },
              { value: "var", label: "Varyantı olanlar" },
              { value: "yok", label: "Varyantsız" },
            ]}
          />
          {anyFilter && (
            <Button variant="ghost" size="icon" onClick={clearFilters} aria-label="Filtreleri temizle" title="Filtreleri temizle">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <DataTable
        storageKey="products"
        columns={columns}
        data={filtered}
        onRowDoubleClick={openDetail}
        onDeleteSelected={canWrite && !showDeleted ? handleBulkDelete : undefined}
        bulkConfirmText="Seçili {n} ürün silinecek (pasife alınacak). Yanlışlıkla silerseniz 'Silinen ürünler' bölümünden geri alabilirsiniz. Devam edilsin mi?"
        isDeleting={isDeleting}
        selectionActions={
          canWrite
            ? (rows, clear) =>
                showDeleted ? (
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!confirm(`Seçili ${rows.length} ürün geri alınsın mı?`)) return;
                      await handleRestore(rows.map((r) => r.id));
                      clear();
                    }}
                  >
                    <Undo2 className="mr-2 h-4 w-4" />
                    Seçilenleri geri al ({rows.length})
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setBulkIds(rows.map((r) => r.id))}>
                    <ListChecks className="mr-2 h-4 w-4" />
                    Toplu güncelle ({rows.length})
                  </Button>
                )
            : undefined
        }
        toolbar={<span className="text-sm text-muted-foreground">{filtered.length} / {data.length} ürün</span>}
      />

      {bulkIds && <BulkUpdateDialog open onOpenChange={(o) => !o && setBulkIds(null)} ids={bulkIds} groups={groups} onDone={() => router.refresh()} />}

      {formOpen && <ProductForm open={formOpen} onOpenChange={setFormOpen} initialData={editingProduct} groups={groups} />}
    </div>
  );
}
