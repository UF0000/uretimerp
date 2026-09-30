import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getStockCount } from "@/app/actions/stock-counts";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readAll } from "@/lib/supabase/read-all";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { CountSheet } from "../components/count-sheet";

export const metadata: Metadata = { title: "Stok Sayımı" };
export const dynamic = "force-dynamic";

const trDate = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join(".") : "—");
const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Sayılıyor", variant: "default" },
  completed: { label: "Tamamlandı", variant: "secondary" },
  cancelled: { label: "İptal", variant: "destructive" },
};

export default async function StockCountPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("master-data:read");
  const { id } = await params;
  const data = await getStockCount(id);
  if (!data) notFound();
  const supabase = await createClient();
  // Kalem eklemede seçilecek ürünler
  const products = data.count.status === "open" ? await readAll((from, to) => supabase.from("products").select("id, code, name").eq("active", true).order("code").order("id").range(from, to), "Ürünler okunamadı") : [];
  const c = data.count;
  const st = STATUS[c.status] ?? { label: c.status, variant: "outline" as const };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title={`Stok Sayımı ${c.no}`}
          description={`${c.warehouse?.name ?? ""} · ${trDate(c.count_date)} · ${c.scope ?? ""}`}
          actions={
            <Link href="/depo/sayim" className={buttonVariants({ variant: "outline" })}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Sayımlar
            </Link>
          }
        />
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant={st.variant}>{st.label}</Badge>
          <span>Oluşturan: {c.creator?.name ?? "—"} · {formatDateTime(c.created_at)}</span>
          {c.completed_at && <span>Tamamlayan: {c.completer?.name ?? "—"} · {formatDateTime(c.completed_at)}</span>}
          {c.note && <span>Not: {c.note}</span>}
        </div>
      </div>

      {/* Yazdırma başlığı */}
      <header className="hidden items-start justify-between gap-6 border-b border-border pb-3 print:flex">
        <div className="rounded-md bg-logo-surface p-1">
          <Image src="/logo-sifonik.png" alt="Sifonik" width={319} height={89} className="h-10 w-auto" />
        </div>
        <div className="text-right text-sm">
          <h1 className="text-lg font-bold">STOK SAYIM LİSTESİ</h1>
          <p className="font-semibold">{c.no}</p>
          <p>
            {c.warehouse?.name} · {trDate(c.count_date)}
          </p>
          <p className="text-muted-foreground">{c.scope}</p>
        </div>
      </header>

      <CountSheet data={data} products={products} />

      {/* Yazdırma imza alanı */}
      <footer className="hidden grid-cols-3 gap-6 pt-8 print:grid">
        {["Sayan", "Kontrol eden", "Depo sorumlusu"].map((t) => (
          <div key={t} className="space-y-8 text-center text-sm">
            <p className="font-semibold">{t}</p>
            <p className="border-t border-border pt-1 text-xs text-muted-foreground">Ad Soyad / İmza</p>
          </div>
        ))}
      </footer>
    </div>
  );
}
