import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Yetkisiz Erişim",
};

export default function UnauthorizedPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Yetkisiz Erişim" />
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={ShieldAlert}
            title="Bu sayfa için yetkiniz yok"
            description="Rolünüz bu işlemi yapmaya izin vermiyor. Gerekiyorsa yöneticinizden rol değişikliği isteyin."
          />
          <div className="mt-4 flex justify-center">
            <Link href="/dashboard" className={buttonVariants()}>
              Panele dön
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
