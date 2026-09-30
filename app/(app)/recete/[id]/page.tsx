import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProducts } from "@/app/actions/master-data/products";
import { getLines, getMolds } from "@/app/actions/master-data/equipment";
import { getBomById } from "@/app/actions/bom";
import { PageHeader } from "@/components/shared/page-header";
import { BomForm } from "../components/bom-form";

import { requirePermission } from "@/lib/auth";
export const metadata: Metadata = {
  title: "Reçete Düzenle",
  description: "Üretim reçetesini düzenle",
};

export default async function EditBomPage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("master-data:write");
  const params = await props.params;
  const [products, lines, molds, bom] = await Promise.all([
    getProducts(),
    getLines(),
    getMolds(),
    getBomById(params.id),
  ]);
  if (!bom) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reçete Düzenle"
        description="Mevcut üretim reçetesini güncelleyin"
      />
      
      <BomForm 
        initialData={bom}
        products={products} 
        lines={lines} 
        molds={molds} 
      />
    </div>
  );
}
