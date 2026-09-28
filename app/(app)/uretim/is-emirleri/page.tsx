import { Metadata } from "next";
import Link from "next/link";
import { Gauge } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getWorkOrders } from "@/app/actions/work-orders";
import { getProducts } from "@/app/actions/master-data/products";
import { getWarehouses } from "@/app/actions/master-data/warehouses";
import { getReasonCodes } from "@/app/actions/master-data/reason-codes";
import { getRawLots } from "@/app/actions/production";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { WorkOrderTable } from "./components/work-order-table";

export const metadata: Metadata = {
  title: "İş Emirleri",
  description: "Üretim planlama ve iş emri yönetimi",
};

export default async function WorkOrdersPage() {
  const [workOrders, products, warehouses, reasonCodes, rawLots] = await Promise.all([
    getWorkOrders(),
    getProducts(),
    getWarehouses(),
    getReasonCodes(),
    getRawLots(),
  ]);

  const scrapProducts = products.filter((p) => p.type === "scrap" || p.type === "regrind");
  const targetWarehouses = warehouses.filter((w) => w.type === "finished");

  return (
    <div className="space-y-6">
      <PageHeader
        title="İş Emirleri (Üretim Planı)"
        description="Makinelerde üretimi planlanan ve devam eden iş emirlerinin takibi"
        actions={
          <Link href="/uretim/oee" className={buttonVariants({ variant: "outline" })}>
            <Gauge className="mr-2 h-4 w-4" />
            OEE Raporu
          </Link>
        }
      />
      
      <Card>
        <CardContent className="pt-6">
          <WorkOrderTable data={workOrders} scrapProducts={scrapProducts} targetWarehouses={targetWarehouses} reasonCodes={reasonCodes} rawLots={rawLots} />
        </CardContent>
      </Card>
    </div>
  );
}
