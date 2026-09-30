import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { RoleProvider } from "@/components/shared/role-provider";
import { EmbedBridge } from "@/components/shared/embed-bridge";

/**
 * Uygulama sayfaları çalışma alanındaki (/calisma) sekmelerin içinde açılır;
 * menü ve üst bar çalışma alanındadır, burada yalnızca sayfa içeriği var.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Profili olmayan veya pasif kullanıcı uygulamaya giremez
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <RoleProvider role={user.role}>
      <Suspense fallback={null}>
        <EmbedBridge />
      </Suspense>
      <main className="h-screen overflow-y-auto p-4 md:p-6 lg:p-8 print:h-auto print:overflow-visible print:p-0">
        {children}
      </main>
    </RoleProvider>
  );
}
