"use server";

import { createClient } from "@/lib/supabase/server";

export async function getDashboardMetrics() {
  const supabase = await createClient();

  // 1. Aktif İş Emirleri (in_progress)
  const { count: activeWorkOrders } = await supabase
    .from("work_orders")
    .select("*", { count: "exact", head: true })
    .eq("status", "in_progress");

  // 2. Bekleyen Siparişler (open veya in_production)
  const { count: pendingOrders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .in("status", ["open", "in_production"]);

  // 3. Bugün Üretilen Miktar
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: todayProduction } = await supabase
    .from("production_entries")
    .select("produced_qty")
    .is("cancelled_at", null)
    .gte("entry_time", today.toISOString());
    
  const totalProducedToday = todayProduction?.reduce((sum, item) => sum + Number(item.produced_qty), 0) || 0;

  // 4. Son 7 Günün Üretim Trendi
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const { data: weeklyProduction } = await supabase
    .from("production_entries")
    .select("produced_qty, entry_time")
    .is("cancelled_at", null)
    .gte("entry_time", sevenDaysAgo.toISOString())
    .order("entry_time", { ascending: true });

  // Günlere göre grupla
  const trendMap: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    trendMap[dateStr] = 0;
  }

  weeklyProduction?.forEach(item => {
    if (!item.entry_time) return;
    const dateStr = item.entry_time.split("T")[0];
    if (trendMap[dateStr] !== undefined) {
      trendMap[dateStr] += Number(item.produced_qty);
    }
  });

  const productionTrend = Object.keys(trendMap).map(date => ({
    date, // e.g. "2026-07-03"
    amount: trendMap[date]
  }));

  // 5. Son Tamamlanan İş Emirleri (En yeni 5)
  const { data: recentCompletedOrders } = await supabase
    .from("work_orders")
    .select(`
      id, no, finished_at,
      product:products(name, code, unit)
    `)
    .eq("status", "done")
    .order("finished_at", { ascending: false })
    .limit(5);

  return {
    metrics: {
      activeWorkOrders: activeWorkOrders || 0,
      pendingOrders: pendingOrders || 0,
      totalProducedToday,
      lowStockAlerts: 0, // Karmaşık join gerektirdiği için şimdilik 0 (İstenirse v_stock ile yapılabilir)
    },
    productionTrend,
    recentCompletedOrders: recentCompletedOrders || []
  };
}
