"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, ImageOff, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { deleteProduct, bulkImportProducts, bulkDeleteProducts } from "@/app/actions/master-data/products";
import { ProductFormInput } from "@/lib/validations/master-data";
import { CATEGORY_LABELS, PRODUCT_TYPE_BADGE, PRODUCT_TYPE_LABELS, PRODUCT_TYPES, categoryLabel, type ProductType } from "@/lib/product-meta";
import type { ExcelRow } from "@/lib/excel";
import type { Tables } from "@/lib/supabase/database.types";
import { formatTR } from "@/lib/format";
import { ProductForm } from "./product-form";
import { ExcelImportButton } from "./excel-import-button";
import { getErrorMessage } from "@/lib/utils";
import { usePermission } from "@/components/shared/role-provider";

type Product = Tables<"products">;

interface ProductsTabProps {
  data: Product[];
  groups: { code: string; name: string }[];
}

const ALL = "";

export function ProductsTab({ data, groups }: ProductsTabProps) {
  const router = useRouter();
  const canWrite = usePermission("master-data:write");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductFormInput | undefined>(undefined);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Filtreler ──
  const [q, setQ] = useState("");
  const [type, setType] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [groupCode, setGroupCode] = useState(ALL);
  const [materialGroup, setMaterialGroup] = useState(ALL);
  const [variant, setVariant] = useState(ALL);

  const groupName = useMemo(() => new Map(groups.map((g) => [g.code, g.name])), [groups]);
  const distinct = (pick: (p: Product) => string | null) => [...new Set(data.map(pick).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, "tr"));
  const groupCodes = useMemo(() => [...new Set([...groups.map((g) => g.code), ...distinct((p) => p.group_code)])].sort(), [data, groups]); // eslint-disable-line react-hooks/exhaustive-deps
  const materialGroups = useMemo(() => distinct((p) => p.material_group), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return data.filter(
      (p) =>
        (!needle ||
          [p.code, p.name, p.group_code, p.variant_code, p.material_grade].some((v) => v?.toLocaleLowerCase("tr").includes(needle))) &&
        (!type || p.type === type) &&
        (!category || p.category === category) &&
        (!groupCode || p.group_code === groupCode) &&
        (!materialGroup || p.material_group === materialGroup) &&
        (!variant || (variant === "var" ? Boolean(p.variant_code) : !p.variant_code)),
    );
  }, [data, q, type, category, groupCode, materialGroup, variant]);
  const anyFilter = Boolean(q || type || category || groupCode || materialGroup || variant);
  const clearFilters = () => {
    setQ("");
    setType(ALL);
    setCategory(ALL);
    setGroupCode(ALL);
    setMaterialGroup(ALL);
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
      cell: ({ row }) =>
        row.original.group_code ? (
          <span title={groupName.get(row.original.group_code) ?? ""}>
            {row.original.group_code}
            {groupName.has(row.original.group_code) && <span className="ml-1 text-xs text-muted-foreground">{groupName.get(row.original.group_code)}</span>}
          </span>
        ) : (
          "—"
        ),
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
            {canWrite && (
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
          <h2 className="text-lg font-medium tracking-tight">Ürünler ve Hammaddeler</h2>
          <p className="text-sm text-muted-foreground">Ayrıntı için satıra çift tıklayın · sütun kenarlarını sürükleyerek genişliği ayarlayın</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kod, ad, grup veya genel kod ara…" className="pl-9" />
        </div>
        <SearchableSelect
          value={type}
          onValueChange={setType}
          placeholder="Tüm türler"
          options={[{ value: ALL, label: "Tüm türler" }, ...PRODUCT_TYPES.map((t) => ({ value: t, label: PRODUCT_TYPE_LABELS[t] }))]}
        />
        <SearchableSelect
          value={category}
          onValueChange={setCategory}
          placeholder="Tüm aileler"
          options={[{ value: ALL, label: "Tüm aileler" }, ...Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
        />
        <SearchableSelect
          value={groupCode}
          onValueChange={setGroupCode}
          placeholder="Tüm grup kodları"
          options={[{ value: ALL, label: "Tüm grup kodları" }, ...groupCodes.map((c) => ({ value: c, label: groupName.has(c) ? `${c} — ${groupName.get(c)}` : c }))]}
        />
        <SearchableSelect
          value={materialGroup}
          onValueChange={setMaterialGroup}
          placeholder="Tüm malzeme grupları"
          options={[{ value: ALL, label: "Tüm malzeme grupları" }, ...materialGroups.map((m) => ({ value: m, label: m }))]}
        />
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
        onDeleteSelected={canWrite ? handleBulkDelete : undefined}
        isDeleting={isDeleting}
        toolbar={<span className="text-sm text-muted-foreground">{filtered.length} / {data.length} ürün</span>}
      />

      {formOpen && <ProductForm open={formOpen} onOpenChange={setFormOpen} initialData={editingProduct} groups={groups} />}
    </div>
  );
}
