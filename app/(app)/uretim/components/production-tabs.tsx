"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/uretim/analiz", label: "Üretim Analizi", icon: BarChart3 },
  { href: "/uretim/is-emirleri", label: "İş Emirleri / Üretim Takibi", icon: ClipboardList },
];

/** Üretim modülü alt menüsü: analiz panosu ve iş emri / üretim girişi. */
export function ProductionTabs() {
  const pathname = usePathname();
  return (
    <nav className="-mt-2 flex gap-1 overflow-x-auto border-b border-border print:hidden" aria-label="Üretim">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" aria-hidden />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
