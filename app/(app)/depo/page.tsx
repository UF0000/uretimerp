import { Metadata } from "next";
import Link from "next/link";
import { GitBranch } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getRegrindScrapByGrade, getStockOverview, getWarehouseOptions } from "@/app/actions/stock";
import { getProductGroups } from "@/app/actions/master-data/products";
import { RegrindScrapSummary } from "./components/regrind-scrap-summary";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StockTable } from "./components/stock-table";

export const metadata: Metadata = {
  title: "Güncel Stok Durumu",
  description: "Tüm depoların anlık stok durumu",
};

export default async function StockPage() {
  const [stockData, regrindScrap, warehouses, groups] = await Promise.all([getStockOverview(), getRegrindScrapByGrade(), getWarehouseOptions(), getProductGroups()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Güncel Stok Durumu"
        description="Fabrikadaki tüm malzemelerin anlık stok miktarları ve depo bazlı dağılımları"
        actions={
          <Link href="/depo/izlenebilirlik" className={buttonVariants({ variant: "outline" })}>
            <GitBranch className="mr-2 h-4 w-4" />
            İzlenebilirlik
          </Link>
        }
      />
      
      <Card>
        <CardContent className="pt-6">
          <StockTable data={stockData} warehouses={warehouses} groups={groups} />
        </CardContent>
      </Card>

      <RegrindScrapSummary groups={regrindScrap} />
    </div>
  );
}
