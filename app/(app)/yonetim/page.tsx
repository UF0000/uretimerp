import type { Metadata } from "next";

import { getParameters, getUsers } from "@/app/actions/admin";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersPanel } from "./components/users-panel";
import { ParametersForm } from "./components/parameters-form";
import { ExportPanel } from "./components/export-panel";

export const metadata: Metadata = {
  title: "Yönetim",
  description: "Kullanıcı rolleri, sistem parametreleri ve dışa aktarım",
};

export const dynamic = "force-dynamic";

export default async function ManagementPage() {
  const me = await requirePermission("admin:all");
  const [users, parameters] = await Promise.all([getUsers(), getParameters()]);
  const { id: _id, ...parameterValues } = parameters;
  void _id;

  return (
    <div className="space-y-6">
      <PageHeader title="Yönetim" description="Kullanıcı rolleri, maliyet/üretim parametreleri ve veri dışa aktarımı" />
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="mb-4 max-w-full justify-start overflow-x-auto">
              <TabsTrigger value="users">Kullanıcılar ve Roller</TabsTrigger>
              <TabsTrigger value="parameters">Parametreler</TabsTrigger>
              <TabsTrigger value="export">Dışa Aktarım / Yedek</TabsTrigger>
            </TabsList>
            <TabsContent value="users" className="m-0">
              <UsersPanel users={users} currentUserId={me.id} />
            </TabsContent>
            <TabsContent value="parameters" className="m-0">
              <ParametersForm initial={parameterValues} />
            </TabsContent>
            <TabsContent value="export" className="m-0">
              <ExportPanel />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
