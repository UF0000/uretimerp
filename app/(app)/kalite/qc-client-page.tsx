"use client";

import { useState } from "react";
import { QCTable } from "./components/qc-table";
import { QCModal } from "./components/qc-modal";
import { NcrTable } from "./components/ncr-table";
import { NcrCreateModal, type NcrPrefill } from "./components/ncr-create-modal";
import { NcrCloseModal } from "./components/ncr-close-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ProductRow } from "@/app/actions/master-data/products";
import type { WarehouseRow } from "@/app/actions/master-data/warehouses";
import type { WorkOrderRow } from "@/app/actions/work-orders";
import type { NcrRow, QualityCheckRow } from "@/app/actions/quality";

interface QCClientPageProps {
  data: QualityCheckRow[];
  ncrs: NcrRow[];
  products: ProductRow[];
  workOrders: WorkOrderRow[];
  warehouses: WarehouseRow[];
}

export function QCClientPage({ data, ncrs, products, workOrders, warehouses }: QCClientPageProps) {
  const [tab, setTab] = useState("checks");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ncrCreateOpen, setNcrCreateOpen] = useState(false);
  const [ncrPrefill, setNcrPrefill] = useState<NcrPrefill | null>(null);
  const [closingNcr, setClosingNcr] = useState<NcrRow | null>(null);
  const openNcrCount = ncrs.filter((n) => n.status === "open").length;

  const openNcr = (prefill: NcrPrefill | null) => {
    setNcrPrefill(prefill);
    setNcrCreateOpen(true);
  };

  return (
    <>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="checks">Kontroller</TabsTrigger>
          <TabsTrigger value="ncr">
            Uygunsuzluklar (NCR){openNcrCount > 0 ? ` · ${openNcrCount} açık` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checks" className="m-0">
          <QCTable
            data={data}
            onAdd={() => setIsModalOpen(true)}
            onOpenNcr={(qc) => {
              setTab("ncr");
              openNcr({ product_id: qc.product_id, lot_no: qc.lot_no, quality_check_id: qc.id });
            }}
          />
        </TabsContent>

        <TabsContent value="ncr" className="m-0">
          <NcrTable data={ncrs} onAdd={() => openNcr(null)} onCloseNcr={setClosingNcr} />
        </TabsContent>
      </Tabs>

      <QCModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} products={products} workOrders={workOrders} />
      <NcrCreateModal
        isOpen={ncrCreateOpen}
        onClose={() => setNcrCreateOpen(false)}
        products={products}
        warehouses={warehouses}
        prefill={ncrPrefill}
      />
      <NcrCloseModal ncr={closingNcr} onClose={() => setClosingNcr(null)} warehouses={warehouses} />
    </>
  );
}
