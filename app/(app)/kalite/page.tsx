import { Metadata } from "next";
import { getQualityChecks } from "@/app/actions/quality";
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
  const [qualityChecks, products, workOrders] = await Promise.all([
    getQualityChecks(),
    getProducts(),
    getWorkOrders(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kalite Kontrol"
        description="Girdi, proses ve son kontrol kayıtları"
      />
      
      <Card>
        <CardContent className="pt-6">
          <QCClientPage 
            data={qualityChecks} 
            products={products} 
            workOrders={workOrders} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
