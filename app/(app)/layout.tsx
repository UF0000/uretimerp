import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shared/sidebar";
import { Topbar } from "@/components/shared/topbar";
import { getCurrentUser } from "@/lib/auth";
import { RoleProvider } from "@/components/shared/role-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Profili olmayan veya pasif kullanıcı uygulamaya giremez
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const userName = user.name;
  const userRole = user.role;

  return (
    <RoleProvider role={userRole}>
      <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
        {/* Sol Yan Menü */}
        <Sidebar />

        {/* Ana İçerik Alanı */}
        <div className="flex flex-1 flex-col overflow-hidden print:overflow-visible">
          {/* Üst Bar */}
          <Topbar userName={userName} userRole={userRole} />

          {/* Sayfa İçeriği */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 print:overflow-visible print:p-0">
            {children}
          </main>
        </div>
      </div>
    </RoleProvider>
  );
}
