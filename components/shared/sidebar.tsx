"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NAV_ITEMS } from "@/components/shared/nav-items";
import { useCan } from "@/components/shared/role-provider";
import { useWorkspaceNav } from "@/components/shared/workspace-nav";

// ─── Sidebar Bileşeni ──────────────────────────────

export const Sidebar = () => {
  const routePath = usePathname();
  const ws = useWorkspaceNav();
  // Çalışma alanında etkin sekmenin adresi
  const pathname = ws?.path ?? routePath;
  const can = useCan();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar print:hidden",
        "transition-all duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo / Başlık */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm shrink-0">
          ÜE
        </div>
        {!collapsed && (
          <span className="font-semibold text-sidebar-foreground text-sm truncate">
            Üretim ERP
          </span>
        )}
      </div>

      {/* Navigasyon */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.filter((item) => !item.permission || can(item.permission)).map((item) => {
          const isActive =
            pathname === (item.activePrefix ?? item.href) || pathname.startsWith(`${item.activePrefix ?? item.href}/`);
          const Icon = item.icon;

          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => {
                if (!ws || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                // Ctrl+tık: yeni sekmede; normal tık: açık sekmede
                if (e.ctrlKey || e.metaKey) ws.openNew(item.href);
                else ws.navigate(item.href);
              }}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                "transition-colors duration-150",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 shrink-0",
                  isActive
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/50"
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      {/* Daralt/Genişlet butonu */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center justify-center w-full py-2 rounded-lg",
            "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
            "transition-colors duration-150"
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
};
