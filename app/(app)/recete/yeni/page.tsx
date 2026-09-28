import { Metadata } from "next";
import { getProducts } from "@/app/actions/master-data/products";
import { getLines, getMolds } from "@/app/actions/master-data/equipment";
import { PageHeader } from "@/components/shared/page-header";
import { BomForm } from "../components/bom-form";

import { requirePermission } from "@/lib/auth";
export const metadata: Metadata = {
  title: "Yeni Reçete Ekle",
  description: "Sisteme yeni bir üretim reçetesi ekle",
};

export default async function NewBomPage() {
  await requirePermission("master-data:write");
  const [products, lines, molds] = await Promise.all([
    getProducts(),
    getLines(),
    getMolds(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yeni Reçete Oluştur"
        description="Üretim için gerekli hammadde, makine ve proses parametrelerini tanımlayın"
      />
      
      <BomForm 
        products={products} 
        lines={lines} 
        molds={molds} 
      />
    </div>
  );
}
