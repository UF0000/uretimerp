"use client";

import { useState } from "react";
import { QCTable } from "./components/qc-table";
import { QCModal } from "./components/qc-modal";

import type { ProductRow } from "@/app/actions/master-data/products";
import type { WorkOrderRow } from "@/app/actions/work-orders";
import type { QualityCheckRow } from "@/app/actions/quality";
interface QCClientPageProps {
  data: QualityCheckRow[];
  products: ProductRow[];
  workOrders: WorkOrderRow[];
}

export function QCClientPage({ data, products, workOrders }: QCClientPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <QCTable data={data} onAdd={() => setIsModalOpen(true)} />
      
      <QCModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        products={products}
        workOrders={workOrders}
      />
    </>
  );
}
