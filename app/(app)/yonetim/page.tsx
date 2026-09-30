import type { Metadata } from "next";

import { getParameters, getUsers } from "@/app/actions/admin";
import { getCapacitySettings } from "@/app/actions/admin/capacity";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersPanel } from "./components/users-panel";
import { ParametersForm } from "./components/parameters-form";
import { ExportPanel } from "./components/export-panel";
import { LineCapacitiesPanel } from "./components/line-capacities-panel";
import { ReferenceCapacitiesPanel } from "./components/reference-capacities-panel";
import { CalendarPanel } from "./components/calendar-panel";
import { ActivityPanel } from "./components/activity-panel";

export const metadata: Metadata = {
  title: "Yönetim",
  description: "Kullanıcı rolleri, sistem parametreleri ve dışa aktarım",
};

export const dynamic = "force-dynamic";

export default async function ManagementPage() {
  const me = await requirePermission("admin:all");
  const [users, parameters, capacity] = await Promise.all([getUsers(), getParameters(), getCapacitySettings()]);
  const { id: _id, ...parameterValues } = parameters;
  void _id;

  return (
    <div className="space-y-6">
      <PageHeader title="Yönetim" description="Kullanıcı rolleri, parametreler, kapasite ve çalışma takvimi, veri dışa aktarımı" />
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="mb-4 max-w-full justify-start overflow-x-auto">
              <TabsTrigger value="users">Kullanıcılar ve Roller</TabsTrigger>
              <TabsTrigger value="parameters">Parametreler</TabsTrigger>
              <TabsTrigger value="line-capacity">Makine Kapasitesi</TabsTrigger>
              <TabsTrigger value="reference-capacity">Referans Kapasite</TabsTrigger>
              <TabsTrigger value="calendar">Çalışma Takvimi</TabsTrigger>
              <TabsTrigger value="activity">İşlem Geçmişi</TabsTrigger>
              <TabsTrigger value="export">Dışa Aktarım / Yedek</TabsTrigger>
            </TabsList>
            <TabsContent value="users" className="m-0">
              <UsersPanel users={users} currentUserId={me.id} />
            </TabsContent>
            <TabsContent value="parameters" className="m-0">
              <ParametersForm initial={parameterValues} />
            </TabsContent>
            <TabsContent value="line-capacity" className="m-0">
              <LineCapacitiesPanel lines={capacity.lines} capacities={capacity.lineCapacities} />
            </TabsContent>
            <TabsContent value="reference-capacity" className="m-0">
              <ReferenceCapacitiesPanel rows={capacity.referenceCapacities} materialGroups={capacity.materialGroups} />
            </TabsContent>
            <TabsContent value="calendar" className="m-0">
              <CalendarPanel weeklyOffDays={capacity.weeklyOffDays} holidays={capacity.holidays} />
            </TabsContent>
            <TabsContent value="activity" className="m-0">
              <ActivityPanel users={users.map((u) => ({ id: u.id, name: u.name }))} />
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
