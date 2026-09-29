"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { setProductImage } from "@/app/actions/product-detail";
import { createClient } from "@/lib/supabase/client";
import { usePermission } from "@/components/shared/role-provider";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;

export function ProductImage({ productId, name, url }: { productId: string; name: string; url: string | null }) {
  const canWrite = usePermission("master-data:write");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Yalnızca resim dosyası yüklenebilir.");
    if (file.size > MAX_BYTES) return toast.error("Görsel en fazla 5 MB olabilir.");
    try {
      setBusy(true);
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${productId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      await setProductImage(productId, data.publicUrl);
      toast.success("Görsel kaydedildi");
    } catch (error) {
      toast.error("Görsel yüklenemedi", { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    if (!confirm("Ürün görseli kaldırılsın mı?")) return;
    try {
      setBusy(true);
      await setProductImage(productId, null);
      toast.success("Görsel kaldırıldı");
    } catch (error) {
      toast.error("Kaldırılamadı", { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
        {url ? (
          <Image src={url} alt={name} fill unoptimized sizes="320px" className="object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <ImageOff className="h-10 w-10" aria-hidden />
            Görsel yok
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="h-6 w-6 animate-spin" aria-label="Yükleniyor" />
          </div>
        )}
      </div>
      {canWrite && (
        <div className="flex gap-2">
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button type="button" variant="outline" size="sm" className="flex-1" disabled={busy} onClick={() => input.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" />
            {url ? "Görseli değiştir" : "Görsel yükle"}
          </Button>
          {url && (
            <Button type="button" variant="ghost" size="icon" disabled={busy} onClick={remove} aria-label="Görseli kaldır">
              <Trash2 className="h-4 w-4 text-danger" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
