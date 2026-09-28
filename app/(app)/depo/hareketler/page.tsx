import { Metadata } from "next";
import { getStockMovements } from "@/app/actions/stock";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { MovementTable } from "../components/movement-table";

export const metadata: Metadata = {
  title: "Stok Hareket Geçmişi",
  description: "Depolardaki tüm giriş ve çıkış işlemleri",
};

export default async function MovementsPage() {
  const movements = await getStockMovements(500); // Son 500 hareket

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stok Hareket Defteri (Ledger)"
        description="Sistemdeki tüm giren ve çıkan stok hareketlerinin kronolojik listesi"
      />
      
      <Card>
        <CardContent className="pt-6">
          <MovementTable data={movements} />
        </CardContent>
      </Card>
    </div>
  );
}
