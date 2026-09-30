import type { Metadata } from "next";

import { getPurchaseFormData } from "@/app/actions/purchase";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { PurchaseOrderForm } from "../components/purchase-order-form";

export const metadata: Metadata = { title: "Yeni Satın Alma Siparişi" };

export default async function NewPurchaseOrderPage() {
  await requirePermission("order:write");
  const data = await getPurchaseFormData();
  return (
    <div className="space-y-6">
      <PageHeader back={{ href: "/siparisler/satin-alma", label: "Satın alma siparişleri" }}
        title="Yeni Satın Alma Siparişi" description="Taslak olarak kaydedilir; tedarikçiye verince “Sipariş verildi” ile işaretleyin" />
      <PurchaseOrderForm data={data} />
    </div>
  );
}
