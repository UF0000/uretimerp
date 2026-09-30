import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { RoleProvider } from "@/components/shared/role-provider";
import { WorkspaceLoader } from "@/components/shared/workspace-loader";
import { isAppPath } from "@/lib/workspace";

export const metadata: Metadata = { title: "Çalışma alanı" };

/** Sekmeli çalışma alanı: menü + sekme çubuğu; her sekme bir uygulama sayfasını açık tutar */
export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ ac?: string | string[] }> }) {
  // Profili olmayan veya pasif kullanıcı uygulamaya giremez
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { ac } = await searchParams;
  const initialPath = isAppPath(ac) ? ac : null;

  return (
    <RoleProvider role={user.role}>
      <WorkspaceLoader initialPath={initialPath} userName={user.name} userRole={user.role} />
    </RoleProvider>
  );
}
