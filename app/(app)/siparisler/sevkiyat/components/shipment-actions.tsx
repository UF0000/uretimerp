"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Printer } from "lucide-react";
import { toast } from "sonner";

import { cancelShipment } from "@/app/actions/shipments";
import { usePermission } from "@/components/shared/role-provider";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils";

export function ShipmentActions({ id, no, cancelled }: { id: string; no: string; cancelled: boolean }) {
  const router = useRouter();
  const canCancel = usePermission("stock:write");
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    if (!confirm(`${no} iptal edilsin mi? Stok ters kayıtla geri alınır, siparişteki sevk edilen miktar düşer.`)) return;
    try {
      setBusy(true);
      await cancelShipment(id);
      toast.success("İrsaliye iptal edildi; stok geri alındı.");
      router.refresh();
    } catch (error) {
      toast.error("İptal edilemedi", { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button onClick={() => window.print()} disabled={cancelled}>
        <Printer className="mr-2 h-4 w-4" />
        Yazdır
      </Button>
      {canCancel && !cancelled && (
        <Button variant="outline" onClick={cancel} disabled={busy}>
          <Ban className="mr-2 h-4 w-4 text-danger" />
          İrsaliyeyi iptal et
        </Button>
      )}
    </div>
  );
}
