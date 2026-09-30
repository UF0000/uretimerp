"use client";

import { createContext, useContext } from "react";

/** Çalışma alanındaki menülerin (yan menü, mobil menü) sekmeleri yönetmesi için */
export interface WorkspaceNav {
  /** Etkin sekmenin adresi (menüde aktif öğeyi işaretlemek için) */
  path: string;
  /** Etkin sekmede aç */
  navigate: (href: string) => void;
  /** Yeni sekmede aç */
  openNew: (href: string) => void;
}

export const WorkspaceNavContext = createContext<WorkspaceNav | null>(null);

/** Çalışma alanı dışında null döner (menüler normal bağlantı gibi çalışır) */
export const useWorkspaceNav = () => useContext(WorkspaceNavContext);
