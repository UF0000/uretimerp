import { Metadata } from "next";
import { Factory, ShoppingCart, TrendingUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

import { getDashboardMetrics } from "@/app/actions/dashboard";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionChart } from "./components/production-chart";

export const metadata: Metadata = {
  title: "Yönetim Paneli",
  description: "Fabrika genel durum özeti",
};

export default async function DashboardPage() {
  const { metrics, productionTrend, recentCompletedOrders } = await getDashboardMetrics();

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
            <div className="text-2xl font-bold text-danger">0</div>
            <p className="text-xs text-muted-foreground">Tükenmek üzere olanlar</p>
          </CardContent>
        </Card>
      </div>

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
