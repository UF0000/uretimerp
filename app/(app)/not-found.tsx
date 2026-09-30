import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Bulunamayan kayıt / adres (silinmiş sipariş, hatalı bağlantı vb.) */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <SearchX className="h-12 w-12 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Kayıt bulunamadı</h1>
        <p className="max-w-md text-sm text-muted-foreground">Aradığınız kayıt silinmiş, iptal edilmiş ya da bağlantı hatalı olabilir. Bu sekmeyi kapatabilir veya panele dönebilirsiniz.</p>
      </div>
      <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
        Panele dön
      </Link>
    </div>
  );
}
