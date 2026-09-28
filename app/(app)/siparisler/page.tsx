import { Metadata } from "next";
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
      />
      
      <Card>
        <CardContent className="pt-6">
          <OrderTable data={orders} />
        </CardContent>
      </Card>
    </div>
  );
}
