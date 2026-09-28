import { Metadata } from "next";
import { getNCRs, getQualityChecks } from "@/app/actions/quality";
import { getWarehouses } from "@/app/actions/master-data/warehouses";
import { getProducts } from "@/app/actions/master-data/products";
import { getWorkOrders } from "@/app/actions/work-orders";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { QCClientPage } from "./qc-client-page";

export const metadata: Metadata = {
  title: "Kalite Kontrol",
  description: "Üretim ve girdi kalite kontrolleri",
};

export default async function QualityPage() {
  const [qualityChecks, ncrs, products, workOrders, warehouses] = await Promise.all([
    getQualityChecks(),
    getNCRs(),
    getProducts(),
    getWorkOrders(),
    getWarehouses(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kalite Kontrol"
        description="Girdi, proses ve son kontrol kayıtları; uygunsuzluklar (NCR) ve karantina"
      />
      
      <Card>
        <CardContent className="pt-6">
          <QCClientPage 
            data={qualityChecks}
            ncrs={ncrs}
            products={products}
            workOrders={workOrders}
            warehouses={warehouses}
          />
        </CardContent>
      </Card>
    </div>
  );
}
