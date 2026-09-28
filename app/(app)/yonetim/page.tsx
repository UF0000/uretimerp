import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Yönetim",
  description: "Kullanıcı, rol ve sistem ayarları yönetimi",
};

export default function ManagementPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Yönetim"
        description="Sistem genel ayarları ve kullanıcı yetkilendirme"
      />
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={Settings}
            title="Yönetim Modülü"
            description="Bu modül henüz yapım aşamasındadır. Kullanıcı rolleri, loglar ve maliyet parametreleri burada yer alacaktır."
          />
        </CardContent>
      </Card>
    </div>
  );
}
