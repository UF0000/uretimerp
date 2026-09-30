import { requirePermission } from "@/lib/auth";
import { Metadata } from "next";
import { getCompletedWorkOrdersForCosting } from "@/app/actions/cost";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { CostTable } from "./components/cost-table";

export const metadata: Metadata = {
  title: "Maliyet Analizi",
  description: "Üretim maliyetleri ve kârlılık analizleri",
};

export default async function CostPage() {
  await requirePermission("cost:read");
  const costingData = await getCompletedWorkOrdersForCosting();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maliyet Analizi"
        description="Tamamlanmış iş emirlerinin hammadde ve genel gider bazlı üretim maliyetleri"
      />
      
      <Card>
        <CardContent className="pt-6">
          <CostTable data={costingData} />
        </CardContent>
      </Card>
    </div>
  );
}
