"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Link2, Loader2, Plus, Search, Unlink } from "lucide-react";
import { toast } from "sonner";

import { searchProductsForVariant, setVariantCode, type ProductDetail } from "@/app/actions/product-detail";
import { usePermission } from "@/components/shared/role-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTR } from "@/lib/format";
import { cn, getErrorMessage } from "@/lib/utils";

type Hit = { id: string; code: string; name: string; variant_code: string | null };

export function VariantsPanel({ detail }: { detail: ProductDetail }) {
  const canWrite = usePermission("master-data:write");
  const { product, variants, suggestions, variantBase } = detail;
  const [groupCode, setGroupCode] = useState(product.variant_code ?? variantBase ?? "");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [pending, start] = useTransition();
  const inGroup = new Set(variants.map((v) => v.id));

  const run = (action: () => Promise<void>, ok: string) =>
    start(async () => {
      try {
        await action();
        toast.success(ok);
      } catch (error) {
        toast.error("İşlem yapılamadı", { description: getErrorMessage(error) });
      }
    });

  const code = (product.variant_code ?? groupCode).trim().toUpperCase();
  const link = (ids: string[]) => {
    if (!code) return toast.error("Önce genel stok kodunu girin.");
    // Bu ürün henüz gruba bağlı değilse o da eklenir
    run(() => setVariantCode(product.variant_code ? ids : [product.id, ...ids], code), `${ids.length || 1} ürün ${code} grubuna bağlandı`);
  };

  const search = () =>
    start(async () => {
      try {
        setHits(await searchProductsForVariant(q));
      } catch (error) {
        toast.error("Arama yapılamadı", { description: getErrorMessage(error) });
      }
    });

  const unit = product.unit;
  const total = variants.reduce((s, v) => ({ stock: s.stock + v.stock, production: s.production + v.production12m, sale: s.sale + v.sale12m }), { stock: 0, production: 0, sale: 0 });

  return (
    <div className="space-y-4">
      {product.variant_code ? (
        <p className="text-sm">
          Genel stok kodu: <span className="font-semibold">{product.variant_code}</span>
          <span className="text-muted-foreground"> · {variants.length} varyant</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Bu ürün henüz bir varyant grubuna bağlı değil.</p>
      )}

      {variants.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Stok kodu</th>
                <th className="px-3 py-2 font-medium">Ürün</th>
                <th className="px-3 py-2 text-right font-medium">Stok</th>
                <th className="px-3 py-2 text-right font-medium">Üretim (12 ay)</th>
                <th className="px-3 py-2 text-right font-medium">Satış (12 ay)</th>
                {canWrite && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className={cn("border-b border-border last:border-0 even:bg-muted/30", v.id === product.id && "font-semibold")}>
                  <td className="px-3 py-2">
                    {v.id === product.id ? (
                      v.code
                    ) : (
                      <Link href={`/ana-veri/urunler/${v.id}`} className="text-primary underline-offset-2 hover:underline">
                        {v.code}
                      </Link>
                    )}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2">{v.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatTR(v.stock, 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatTR(v.production12m, 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatTR(v.sale12m, 0)}</td>
                  {canWrite && (
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" disabled={pending} onClick={() => run(() => setVariantCode([v.id], null), `${v.code} gruptan çıkarıldı`)} aria-label="Gruptan çıkar" title="Gruptan çıkar">
                        <Unlink className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-border bg-muted/60 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={2}>
                  Toplam ({unit})
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatTR(total.stock, 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatTR(total.production, 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatTR(total.sale, 0)}</td>
                {canWrite && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {canWrite && (
        <div className="space-y-3 rounded-md border border-border p-3">
          {!product.variant_code && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <label htmlFor="variant-group" className="text-xs text-muted-foreground">
                  Genel stok kodu
                </label>
                <Input id="variant-group" value={groupCode} onChange={(e) => setGroupCode(e.target.value)} placeholder="Örn: 1A012020" className="w-48" />
              </div>
              <Button size="sm" disabled={pending || !groupCode.trim()} onClick={() => link([])}>
                <Link2 className="mr-1.5 h-4 w-4" />
                Bu ürünü gruba bağla
              </Button>
            </div>
          )}

          {suggestions.filter((s) => !inGroup.has(s.id)).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Kurala göre olası varyantlar (renk harfi ve firma eki farklı):</p>
              <div className="flex flex-wrap gap-2">
                {suggestions
                  .filter((s) => !inGroup.has(s.id))
                  .map((s) => (
                    <Button key={s.id} size="sm" variant="outline" disabled={pending} onClick={() => link([s.id])} title={s.name}>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      {s.code}
                      {s.variant_code && <Badge variant="secondary" className="ml-1.5">{s.variant_code}</Badge>}
                    </Button>
                  ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Elle varyant ekle:</p>
            <div className="flex gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Stok kodu veya ad ara…" className="max-w-xs" />
              <Button size="sm" variant="outline" onClick={search} disabled={pending || q.trim().length < 2}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {hits.length > 0 && (
              <ul className="divide-y divide-border rounded-md border border-border text-sm">
                {hits
                  .filter((h) => h.id !== product.id)
                  .map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{h.code}</span> <span className="text-muted-foreground">{h.name}</span>
                        {h.variant_code && <Badge variant="secondary" className="ml-1.5">{h.variant_code}</Badge>}
                      </span>
                      {inGroup.has(h.id) ? (
                        <span className="text-xs text-muted-foreground">grupta</span>
                      ) : (
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => link([h.id])}>
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Ekle
                        </Button>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
