"use client";

import { useRef, useState, useTransition } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { addProductDocument, deleteProductDocument, getDocumentUrl, type ProductExtras } from "@/app/actions/product-detail/extras";
import { createClient } from "@/lib/supabase/client";
import { usePermission } from "@/components/shared/role-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { formatDate, formatTR } from "@/lib/format";
import { getErrorMessage } from "@/lib/utils";

const CATEGORIES = {
  cizim: "Teknik çizim",
  belge: "Belge / sertifika",
  foy: "Ürün föyü",
  test: "Test raporu",
  diger: "Diğer",
} as const;
type Category = keyof typeof CATEGORIES;
const MAX_BYTES = 20 * 1024 * 1024;

const sizeLabel = (b: number | null) => (b === null ? "" : b > 1024 * 1024 ? `${formatTR(b / 1024 / 1024, 1)} MB` : `${formatTR(b / 1024, 0)} KB`);

export function DocumentsPanel({ productId, documents }: { productId: string; documents: ProductExtras["documents"] }) {
  const canWrite = usePermission("master-data:write");
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<Category>("cizim");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();

  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) return toast.error("Dosya en fazla 20 MB olabilir.");
    try {
      setUploading(true);
      const supabase = createClient();
      const safe = file.name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80);
      const path = `${productId}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("product-documents").upload(path, file, { contentType: file.type || undefined });
      if (error) throw new Error(error.message);
      await addProductDocument(productId, {
        category,
        title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      setTitle("");
      toast.success("Doküman eklendi");
    } catch (error) {
      toast.error("Yüklenemedi", { description: getErrorMessage(error) });
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const download = (id: string) =>
    start(async () => {
      try {
        // İmzalı bağlantı "indir" olarak döner; sayfa değişmez, dosya iner
        window.location.assign(await getDocumentUrl(id));
      } catch (error) {
        toast.error("İndirilemedi", { description: getErrorMessage(error) });
      }
    });

  const remove = (id: string, name: string) => {
    if (!confirm(`"${name}" silinsin mi?`)) return;
    start(async () => {
      try {
        await deleteProductDocument(id);
        toast.success("Doküman silindi");
      } catch (error) {
        toast.error("Silinemedi", { description: getErrorMessage(error) });
      }
    });
  };

  const grouped = (Object.keys(CATEGORIES) as Category[])
    .map((c) => ({ c, docs: documents.filter((d) => d.category === c) }))
    .filter((g) => g.docs.length > 0);

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="w-44 space-y-1">
            <span className="text-xs text-muted-foreground">Tür</span>
            <SearchableSelect value={category} onValueChange={(v) => v && setCategory(v as Category)} options={Object.entries(CATEGORIES).map(([value, label]) => ({ value, label }))} placeholder="Tür" />
          </div>
          <div className="min-w-48 flex-1 space-y-1">
            <label htmlFor="doc-title" className="text-xs text-muted-foreground">
              Başlık (boşsa dosya adı)
            </label>
            <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn: Kalıp çizimi Rev.3" />
          </div>
          <input ref={input} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button disabled={uploading} onClick={() => input.current?.click()}>
            {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
            Dosya yükle
          </Button>
        </div>
      )}

      {grouped.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Henüz doküman yok. Teknik çizim, TSE/belge, ürün föyü veya test raporu ekleyebilirsiniz (en fazla 20 MB).</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {grouped.map(({ c, docs }) => (
            <div key={c}>
              <h3 className="mb-2 text-sm font-semibold">
                {CATEGORIES[c]} <span className="font-normal text-muted-foreground">({docs.length})</span>
              </h3>
              <ul className="divide-y divide-border rounded-md border border-border text-sm">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium" title={d.title}>
                        {d.title}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {d.file_name} · {sizeLabel(d.size_bytes)} · {d.created_at ? formatDate(d.created_at) : ""}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" disabled={pending} onClick={() => download(d.id)} aria-label="İndir" title="İndir">
                      <Download className="h-4 w-4" />
                    </Button>
                    {canWrite && (
                      <Button size="icon" variant="ghost" disabled={pending} onClick={() => remove(d.id, d.title)} aria-label="Sil" title="Sil">
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
