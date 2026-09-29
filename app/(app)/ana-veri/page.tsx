import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProductGroups, getProducts } from "@/app/actions/master-data/products";
import { getPartners } from "@/app/actions/master-data/partners";
import { getWarehouses } from "@/app/actions/master-data/warehouses";
import { getLines, getMolds } from "@/app/actions/master-data/equipment";
import { getReasonCodes } from "@/app/actions/master-data/reason-codes";

import { ProductsTab } from "./components/products-tab";
import { PartnersTab } from "./components/partners-tab";
import { WarehousesTab } from "./components/warehouses-tab";
import { EquipmentTab } from "./components/equipment-tab";
import { ReasonCodesTab } from "./components/reason-codes-tab";
import { ProductGroupsTab } from "./components/product-groups-tab";
import { OperatorsTab } from "./components/operators-tab";
import { getOperators } from "@/app/actions/master-data/operators";

export const metadata: Metadata = {
  title: "Ana Veri",
  description: "Ürün, hammadde, kalıp, hat, cari, depo ve neden kodları yönetimi",
};

export default async function MasterDataPage() {
  const [products, partners, warehouses, lines, molds, reasonCodes, groups, operators] = await Promise.all([
    getProducts(),
    getPartners(),
    getWarehouses(),
    getLines(),
    getMolds(),
    getReasonCodes(),
    getProductGroups(),
    getOperators(),
  ]);

  // Ürünlerde kullanılan grup kodları ve ürün sayısı
  const usageMap = new Map<string, number>();
  for (const p of products) if (p.group_code) usageMap.set(p.group_code, (usageMap.get(p.group_code) ?? 0) + 1);
  const groupUsage = [...usageMap.entries()].map(([code, count]) => ({ code, count }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ana Veri"
        description="Sistemdeki temel tanımlamaların yönetimi"
        actions={
          <Link href="/ana-veri/eksik-veri" className={buttonVariants({ variant: "outline" })}>
            <ListChecks className="mr-2 h-4 w-4" aria-hidden />
            Eksik veri listesi
          </Link>
        }
      />
      
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="mb-4 max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="products">Ürünler & Hammaddeler</TabsTrigger>
          <TabsTrigger value="groups">Grup Kodları</TabsTrigger>
          <TabsTrigger value="equipment">Kalıp & Hatlar</TabsTrigger>
          <TabsTrigger value="partners">Cariler</TabsTrigger>
          <TabsTrigger value="warehouses">Depolar</TabsTrigger>
          <TabsTrigger value="reason_codes">Neden Kodları</TabsTrigger>
          <TabsTrigger value="operators">Operatörler</TabsTrigger>
        </TabsList>

        <Card>
          <CardContent className="pt-6 min-h-[500px]">
            <TabsContent value="products" className="m-0">
              <ProductsTab data={products} groups={groups} />
            </TabsContent>
            
            <TabsContent value="groups" className="m-0">
              <ProductGroupsTab groups={groups} usage={groupUsage} />
            </TabsContent>

            <TabsContent value="equipment" className="m-0">
              <EquipmentTab lines={lines} molds={molds} products={products} />
            </TabsContent>

            <TabsContent value="partners" className="m-0">
              <PartnersTab data={partners} />
            </TabsContent>

            <TabsContent value="warehouses" className="m-0">
              <WarehousesTab data={warehouses} />
            </TabsContent>

            <TabsContent value="operators" className="m-0">
              <OperatorsTab data={operators} />
            </TabsContent>

            <TabsContent value="reason_codes" className="m-0">
              <ReasonCodesTab data={reasonCodes} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
