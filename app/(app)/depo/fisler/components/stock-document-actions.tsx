"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Printer, Truck } from "lucide-react";
import { toast } from "sonner";

import { cancelStockDocument } from "@/app/actions/stock";
import { usePermission } from "@/components/shared/role-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils";

interface StockDocumentActionsProps {
  id: string;
  no: string;
  cancelled: boolean;
  /** Sevkiyattan doğan fiş: iptal irsaliyeden yapılır (irsaliye de iptal olsun) */
  shipmentId: string | null;
}

export function StockDocumentActions({ id, no, cancelled, shipmentId }: StockDocumentActionsProps) {
  const router = useRouter();
  const canWrite = usePermission("stock:write");
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    if (!confirm(`${no} iptal edilsin mi? Tüm hareketleri ters kayıtla geri alınır.`)) return;
    try {
      setBusy(true);
      await cancelStockDocument(id);
      toast.success("Fiş iptal edildi; stok geri alındı.");
      router.refresh();
    } catch (error) {
      toast.error("İptal edilemedi", { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" />
        Yazdır
      </Button>
      {shipmentId ? (
        <Link href={`/siparisler/sevkiyat/${shipmentId}`} className={buttonVariants({ variant: "outline" })}>
          <Truck className="mr-2 h-4 w-4" />
          Sevk irsaliyesi
        </Link>
      ) : (
        canWrite &&
        !cancelled && (
          <Button variant="outline" onClick={cancel} disabled={busy}>
            <Ban className="mr-2 h-4 w-4 text-danger" />
            Fişi iptal et
          </Button>
        )
      )}
    </div>
  );
}
