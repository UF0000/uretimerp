import { Metadata } from "next";
import { getProducts } from "@/app/actions/master-data/products";
import { getPartners } from "@/app/actions/master-data/partners";
import { PageHeader } from "@/components/shared/page-header";
import { OrderForm } from "../components/order-form";

export const metadata: Metadata = {
  title: "Yeni Sipariş Oluştur",
  description: "Sisteme yeni müşteri siparişi ekle",
};

export default async function NewOrderPage() {
  const [products, partners] = await Promise.all([
    getProducts(),
    getPartners(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yeni Sipariş Girişi"
        description="Müşteriden alınan siparişi kalemleriyle birlikte sisteme kaydedin"
      />
      
      <OrderForm 
        products={products} 
        partners={partners} 
      />
    </div>
  );
}
