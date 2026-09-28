import { Metadata } from "next";
import { getProducts } from "@/app/actions/master-data/products";
import { getLines, getMolds } from "@/app/actions/master-data/equipment";
import { getBoms } from "@/app/actions/bom";
import { getOrders } from "@/app/actions/orders";
import { PageHeader } from "@/components/shared/page-header";
import { WorkOrderForm } from "../components/work-order-form";

import { requirePermission } from "@/lib/auth";
export const metadata: Metadata = {
  title: "Yeni İş Emri (Üretim Planla)",
  description: "Sisteme yeni üretim iş emri ekle",
};

export default async function NewWorkOrderPage() {
  await requirePermission("production:write");
  const [products, boms, lines, molds, orders] = await Promise.all([
    getProducts(),
    getBoms(),
    getLines(),
    getMolds(),
    getOrders(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Üretim Planla (İş Emri)"
        description="Reçete, makine ve miktar seçerek sahaya yeni bir üretim emri gönderin."
      />
      
      <WorkOrderForm 
        products={products} 
        boms={boms} 
        lines={lines}
        molds={molds}
        orders={orders.filter((o) => o.status !== "done" && o.status !== "cancelled")} // Sadece açık siparişler
      />
    </div>
  );
}
