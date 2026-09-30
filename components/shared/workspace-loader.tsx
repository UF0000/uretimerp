"use client";

import dynamic from "next/dynamic";

/** Çalışma alanı yalnızca tarayıcıda çalışır (sekmeler oturum hafızasından geri yüklenir) */
export const WorkspaceLoader = dynamic(() => import("@/components/shared/workspace"), {
  ssr: false,
  loading: () => <div className="h-screen bg-background" />,
});
