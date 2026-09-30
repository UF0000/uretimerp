"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { NAV_ITEMS } from "@/components/shared/nav-items";
import { useCan } from "@/components/shared/role-provider";
import { useWorkspaceNav } from "@/components/shared/workspace-nav";

// ─── Mobil Navigasyon (Sheet) ──────────────────────

export const MobileNav = () => {
  const routePath = usePathname();
  const ws = useWorkspaceNav();
  const pathname = ws?.path ?? routePath;
  const can = useCan();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors">
        <Menu className="w-5 h-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0 border-r-border/50">
        <SheetTitle className="sr-only">Navigasyon Menüsü</SheetTitle>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            ÜE
          </div>
          <span className="font-semibold text-foreground text-sm">
            Üretim ERP
          </span>
        </div>

        {/* Navigasyon */}
        <nav className="py-3 px-2 space-y-1">
          {NAV_ITEMS.filter((item) => !item.permission || can(item.permission)).map((item) => {
            const isActive =
              pathname === (item.activePrefix ?? item.href) || pathname.startsWith(`${item.activePrefix ?? item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  setOpen(false);
                  if (!ws) return;
                  e.preventDefault();
                  ws.navigate(item.href);
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                  "transition-colors duration-150",
                  isActive
                    ? "bg-accent text-primary"
                    : "text-foreground/70 hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 shrink-0",
                    isActive ? "text-primary" : "text-foreground/50"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
};
