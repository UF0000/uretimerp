import { Metadata } from "next";
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
      />
      
      <Card>
        <CardContent className="pt-6">
          <StockTable data={stockData} />
        </CardContent>
      </Card>
    </div>
  );
}
