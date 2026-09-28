import { Metadata } from "next";
import { getBoms } from "@/app/actions/bom";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { BomTable } from "./components/bom-table";

export const metadata: Metadata = {
  title: "Reçeteler (BOM)",
  description: "Ürün reçeteleri ve malzeme listeleri",
};

export default async function RecipesPage() {
  const boms = await getBoms();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reçeteler (BOM)"
        description="Üretim reçetelerinin tanımlanması ve yönetimi"
      />
      
      <Card>
        <CardContent className="pt-6">
          <BomTable data={boms} />
        </CardContent>
      </Card>
    </div>
  );
}
