import Link from "next/link";

/** Uygulamada olmayan adres */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <h1 className="text-xl font-semibold">Sayfa bulunamadı</h1>
      <p className="max-w-md text-sm text-muted-foreground">Bu adreste bir sayfa yok. Bağlantı hatalı ya da sayfa kaldırılmış olabilir.</p>
      <Link href="/dashboard" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
        Panele dön
      </Link>
    </main>
  );
}
