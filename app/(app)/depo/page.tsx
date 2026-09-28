import { Metadata } from "next";
import Link from "next/link";
import { GitBranch } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getStockOverview } from "@/app/actions/stock";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StockTable } from "./components/stock-table";

export const metadata: Metadata = {
  title: "Güncel Stok Durumu",
  description: "Tüm depoların anlık stok durumu",
};

export default async function StockPage() {
  const stockData = await getStockOverview();

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
          <StockTable data={stockData} />
        </CardContent>
      </Card>
    </div>
  );
}
