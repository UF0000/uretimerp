import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProducts } from "@/app/actions/master-data/products";
import { getPartners } from "@/app/actions/master-data/partners";
import { getWarehouses } from "@/app/actions/master-data/warehouses";
import { getLines, getMolds } from "@/app/actions/master-data/equipment";
import { getReasonCodes } from "@/app/actions/master-data/reason-codes";

import { ProductsTab } from "./components/products-tab";
import { PartnersTab } from "./components/partners-tab";
import { WarehousesTab } from "./components/warehouses-tab";
import { EquipmentTab } from "./components/equipment-tab";
import { ReasonCodesTab } from "./components/reason-codes-tab";

export const metadata: Metadata = {
  title: "Ana Veri",
  description: "Ürün, hammadde, kalıp, hat, cari, depo ve neden kodları yönetimi",
};

export default async function MasterDataPage() {
  const [products, partners, warehouses, lines, molds, reasonCodes] = await Promise.all([
    getProducts(),
    getPartners(),
    getWarehouses(),
    getLines(),
    getMolds(),
    getReasonCodes(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ana Veri"
        description="Sistemdeki temel tanımlamaların yönetimi"
      />
      
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="mb-4 max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="products">Ürünler & Hammaddeler</TabsTrigger>
          <TabsTrigger value="equipment">Kalıp & Hatlar</TabsTrigger>
          <TabsTrigger value="partners">Cariler</TabsTrigger>
          <TabsTrigger value="warehouses">Depolar</TabsTrigger>
          <TabsTrigger value="reason_codes">Neden Kodları</TabsTrigger>
        </TabsList>

        <Card>
          <CardContent className="pt-6 min-h-[500px]">
            <TabsContent value="products" className="m-0">
              <ProductsTab data={products} />
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

            <TabsContent value="reason_codes" className="m-0">
              <ReasonCodesTab data={reasonCodes} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
