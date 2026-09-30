import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getShipmentFormData } from "@/app/actions/shipments";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { one } from "@/lib/utils";
import { ShipmentForm } from "../components/shipment-form";

export const metadata: Metadata = { title: "Sevk Et" };
export const dynamic = "force-dynamic";

export default async function NewShipmentPage({ searchParams }: { searchParams: Promise<{ siparis?: string }> }) {
  await requirePermission("stock:write");
  const { siparis } = await searchParams;
  if (!siparis) redirect("/siparisler");
  const data = await getShipmentFormData(siparis);
  const partner = one(data.order.partner);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Sevk et — Sipariş ${data.order.no}`}
        description={`${partner?.name ?? ""}${data.order.delivery_date ? ` · termin ${data.order.delivery_date.split("-").reverse().join(".")}` : ""}`}
        actions={
          <Link href="/siparisler" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Siparişler
          </Link>
        }
      />
      <ShipmentForm data={data} />
    </div>
  );
}
