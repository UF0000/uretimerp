import {
  LayoutDashboard,
  Database,
  ClipboardList,
  Warehouse,
  ShoppingCart,
  Factory,
  Calculator,
  ShieldCheck,
  Settings,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

// ─── Navigasyon öğeleri (sidebar + mobil menü ortak) ───

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Verilirse menüde sadece bu yetkiye sahip kullanıcılar görür */
  permission?: Permission;
  /** Menü öğesinin aktif sayılacağı adres öneki (varsayılan: href) */
  activePrefix?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/ana-veri", label: "Ana Veri", icon: Database },
  { href: "/recete", label: "Reçete / BOM", icon: ClipboardList },
  { href: "/depo", label: "Depo & Stok", icon: Warehouse },
  { href: "/siparisler", label: "Siparişler", icon: ShoppingCart },
  { href: "/uretim/analiz", label: "Üretim", icon: Factory, activePrefix: "/uretim" },
  { href: "/maliyet", label: "Maliyet", icon: Calculator },
  { href: "/kalite", label: "Kalite", icon: ShieldCheck },
  { href: "/yonetim", label: "Yönetim", icon: Settings, permission: "admin:all" },
];
