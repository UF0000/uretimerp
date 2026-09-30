import { Metadata } from "next";
import Link from "next/link";
import { Factory, ShoppingCart, TrendingUp, AlertTriangle, Flame, Wrench } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

import { getDashboardMetrics } from "@/app/actions/dashboard";
import { getScrapSummary } from "@/app/actions/scrap";
import { getMoldMaintenanceAlerts } from "@/app/actions/master-data/equipment";
import { getNotifications } from "@/app/actions/notifications";
import { MAINTENANCE_STATE_BADGE, MAINTENANCE_STATE_LABELS, asMaintenanceState } from "@/lib/mold-maintenance";
import { Badge } from "@/components/ui/badge";
import { formatTR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionChart } from "./components/production-chart";

export const metadata: Metadata = {
  title: "Yönetim Paneli",
  description: "Fabrika genel durum özeti",
};

export default async function DashboardPage() {
  const [{ metrics, productionTrend, recentCompletedOrders }, scrap, moldAlerts, notifications] = await Promise.all([
    getDashboardMetrics(),
    getScrapSummary(),
    getMoldMaintenanceAlerts(),
    getNotifications(),
  ]);
  // Kritik / minimum altı stok: bildirimlerle aynı hesap (kullanılabilir depolar)
  const criticalStock = notifications.filter((n) => n.kind === "stok" && n.severity === "danger").length;
  const minStock = notifications.filter((n) => n.kind === "stok" && n.severity === "warning").length;
  const scrapOver = scrap.scrapPct !== null && scrap.scrapPct * 100 > scrap.targetScrapPct;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Genel Bakış"
        description="Fabrikanın anlık üretim ve operasyonel durumu"
      />
      
      {/* 4 Ana Metrik */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif İş Emirleri</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeWorkOrders}</div>
            <p className="text-xs text-muted-foreground">Şu an üretimde olanlar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bekleyen Siparişler</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pendingOrders}</div>
            <p className="text-xs text-muted-foreground">Açık müşteri siparişleri</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bugünkü Üretim</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {metrics.totalProducedToday.toLocaleString("tr-TR")}
            </div>
            <p className="text-xs text-muted-foreground">Bugün çıkan sağlam miktar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kritik Stoklar</CardTitle>
            <AlertTriangle className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", criticalStock > 0 ? "text-danger" : "text-success")}>{criticalStock}</div>
            <p className="text-xs text-muted-foreground">Kritik seviyede{minStock > 0 ? ` · ${minStock} ürün minimum altında` : ""}</p>
          </CardContent>
        </Card>
      </div>

      <Link href="/uretim/analiz" className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Card className="transition-colors hover:bg-muted/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bu Ay Fire</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-x-8 gap-y-2">
            <div>
              <div className={cn("text-2xl font-bold tabular-nums", scrap.scrapPct === null ? "" : scrapOver ? "text-danger" : "text-success")}>
                {scrap.scrapPct === null ? "—" : `%${formatTR(scrap.scrapPct * 100, 2)}`}
              </div>
              <p className="text-xs text-muted-foreground">hedef ≤ %{formatTR(scrap.targetScrapPct, 1)}</p>
            </div>
            <div>
              <div className="text-lg font-semibold tabular-nums">{formatTR(scrap.scrapKg, 0)} kg</div>
              <p className="text-xs text-muted-foreground">toplam fire · {formatTR(scrap.lostKg, 0)} kg kayıp</p>
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold">{scrap.topReason?.label ?? "—"}</div>
              <p className="text-xs text-muted-foreground">
                en büyük neden{scrap.topReason ? ` · %${formatTR(scrap.topReason.share * 100, 0)}` : ""}
              </p>
            </div>
            <span className="ml-auto text-xs text-primary">Üretim analizi →</span>
          </CardContent>
        </Card>
      </Link>

      {/* Kalıp bakımı: aralığın %80'ine gelen ve geçen kalıplar */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Kalıp Bakımı</CardTitle>
          <Wrench className={cn("h-4 w-4", moldAlerts.some((m) => m.state === "gecikti") ? "text-danger" : "text-muted-foreground")} />
        </CardHeader>
        <CardContent>
          {moldAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bakımı yaklaşan kalıp yok. Bakım aralığı Ana Veri → Kalıp &amp; Hatlar&apos;da kalıp kartından girilir.</p>
          ) : (
            <div className="space-y-2">
              {moldAlerts.slice(0, 6).map((m) => {
                const st = asMaintenanceState(m.state);
                return (
                  <div key={m.mold_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 text-sm last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="font-medium">{m.code}</span> <span className="text-muted-foreground">{m.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-muted-foreground">
                        {formatTR(Number(m.shots_since ?? 0), 0)} / {formatTR(Number(m.interval_shots ?? 0), 0)} atış · %{formatTR(Number(m.used_pct ?? 0), 0)}
                      </span>
                      <Badge variant={MAINTENANCE_STATE_BADGE[st]}>{MAINTENANCE_STATE_LABELS[st]}</Badge>
                    </div>
                  </div>
                );
              })}
              <Link href="/ana-veri" className="inline-block text-xs text-primary">
                {moldAlerts.length > 6 ? `${moldAlerts.length - 6} kalıp daha · ` : ""}Bakım kaydı için Ana Veri → Kalıp &amp; Hatlar →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grafik Bölümü (Sol - 2 Sütun) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Son 7 Günün Üretim Trendi</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ProductionChart data={productionTrend} />
          </CardContent>
        </Card>

        {/* Son Tamamlananlar Bölümü (Sağ - 1 Sütun) */}
        <Card>
          <CardHeader>
            <CardTitle>Son Tamamlanan Üretimler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentCompletedOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{order.product?.code}</p>
                    <p className="text-xs text-muted-foreground">{order.no}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {order.finished_at ? format(new Date(order.finished_at), "dd MMM HH:mm", { locale: tr }) : "-"}
                    </p>
                  </div>
                </div>
              ))}

              {recentCompletedOrders.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Henüz tamamlanmış bir üretim yok.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
