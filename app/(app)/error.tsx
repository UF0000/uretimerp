"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Sayfa hatası: sekmenin tamamı çökmez, mesaj + tekrar dene gösterilir */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <TriangleAlert className="h-12 w-12 text-warning" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Sayfa yüklenirken bir sorun oluştu</h1>
        <p className="max-w-md text-sm text-muted-foreground">{error.message || "Beklenmeyen bir hata oluştu."}</p>
        {error.digest && <p className="text-xs text-muted-foreground">Hata kodu: {error.digest}</p>}
      </div>
      <Button onClick={reset}>Tekrar dene</Button>
    </div>
  );
}
