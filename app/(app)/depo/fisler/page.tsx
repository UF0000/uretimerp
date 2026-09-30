import { getStockDocuments } from "@/app/actions/stock";
import { StockDocumentsTable } from "./components/stock-documents-table";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

export default async function StockDocumentsPage() {
  const [documents, user] = await Promise.all([getStockDocuments(), getCurrentUser()]);
  const canWrite = !!user && hasPermission("stock:write", user.role);

  return (
    <div className="space-y-6">
      <BackLink href="/depo" label="Stok durumu" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stok Fişleri</h1>
          <p className="text-sm text-muted-foreground">
            Sistemdeki tüm toplu stok hareket belgeleri (Giriş, Çıkış, Transfer)
          </p>
        </div>
        {canWrite && (
          <Link href="/depo/fisler/yeni">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Yeni Stok Fişi
            </Button>
          </Link>
        )}
      </div>

      <StockDocumentsTable data={documents || []} />
    </div>
  );
}
