import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { getDataIssues } from "@/app/actions/data-quality";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IssuesList } from "./components/issues-list";

export const metadata: Metadata = {
  title: "Eksik Veri",
  description: "Hesaplamaları etkileyen eksik ana veri listesi",
};

export const dynamic = "force-dynamic";

export default async function DataIssuesPage() {
  const { issues, checkedBoms, checkedMolds } = await getDataIssues();
  const blockers = issues.filter((i) => i.severity === "blocker").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eksik Veri"
        description={`Üretim girişi, OEE, overweight, kapasite, maliyet ve MRP hesaplarını etkileyen boşluklar · ${checkedBoms} aktif reçete, ${checkedMolds} kalıp kontrol edildi`}
        actions={
          <Link href="/ana-veri" className={buttonVariants({ variant: "outline" })}>
            Ana Veri&apos;ye dön
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 pt-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Toplam eksik</div>
            <div className="text-2xl font-semibold tabular-nums">{issues.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hesap yapılamıyor</div>
            <div className="text-2xl font-semibold tabular-nums text-danger">{blockers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hesap eksik çıkıyor</div>
            <div className="text-2xl font-semibold tabular-nums text-warning">{issues.length - blockers}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {issues.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-success" aria-hidden /> Hesapları etkileyen eksik veri yok.
            </p>
          ) : (
            <IssuesList issues={issues} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
