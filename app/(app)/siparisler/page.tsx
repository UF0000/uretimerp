import { Metadata } from "next";
import Link from "next/link";
import { ListChecks, ShoppingBag, Truck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getOrders } from "@/app/actions/orders";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { OrderTable } from "./components/order-table";

export const metadata: Metadata = {
  title: "Müşteri Siparişleri",
  description: "Alınan müşteri siparişlerinin yönetimi",
};

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Siparişler"
        description="Müşterilerden gelen üretim veya sevkiyat siparişlerinin listesi"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/siparisler/sevkiyat" className={buttonVariants({ variant: "outline" })}>
              <Truck className="mr-2 h-4 w-4" />
              Sevkiyatlar
            </Link>
            <Link href="/siparisler/satin-alma" className={buttonVariants({ variant: "outline" })}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              Satın Alma
            </Link>
            <Link href="/siparisler/ihtiyac" className={buttonVariants({ variant: "outline" })}>
              <ListChecks className="mr-2 h-4 w-4" />
              Net İhtiyaç (MRP)
            </Link>
          </div>
        }
      />
      
      <Card>
        <CardContent className="pt-6">
          <OrderTable data={orders} />
        </CardContent>
      </Card>
    </div>
  );
}
