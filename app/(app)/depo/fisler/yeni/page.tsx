import { getProducts } from "@/app/actions/master-data/products";
import { getWarehouses } from "@/app/actions/master-data/warehouses";
import { StockDocumentForm } from "../components/stock-document-form";

export const dynamic = "force-dynamic";

export default async function NewStockDocumentPage() {
  const [products, warehouses] = await Promise.all([
    getProducts(),
    getWarehouses(),
  ]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Yeni Stok Fişi</h1>
        <p className="text-sm text-muted-foreground">
          Toplu stok girişi, çıkışı veya depo transferi oluşturun.
        </p>
      </div>

      <div className="border rounded-lg bg-card text-card-foreground shadow-sm p-6">
        <StockDocumentForm
          products={products || []}
          warehouses={warehouses || []}
        />
      </div>
    </div>
  );
}
