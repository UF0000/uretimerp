import { Metadata } from "next";
import { getProducts } from "@/app/actions/master-data/products";
import { getWarehouses } from "@/app/actions/master-data/warehouses";
import { PageHeader } from "@/components/shared/page-header";
import { MovementForm } from "../components/movement-form";

export const metadata: Metadata = {
  title: "Manuel Stok Hareketi (Fiş)",
  description: "Sisteme manuel stok girişi veya çıkışı ekle",
};

export default async function NewMovementPage() {
  const [products, warehouses] = await Promise.all([
    getProducts(),
    getWarehouses(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yeni Stok Fişi"
        description="Depoya manuel giriş veya çıkış hareketlerini buradan ekleyebilirsiniz. Dikkat: Stok hareketleri silinemez."
      />
      
      <MovementForm 
        products={products} 
        warehouses={warehouses} 
      />
    </div>
  );
}
