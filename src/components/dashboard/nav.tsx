"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  Users,
  Package,
  ClipboardList,
  Settings,
  ShieldCheck,
  ShieldBan,
  SlidersHorizontal,
  Warehouse,
  HandCoins,
  Contact,
  FileText,
  ReceiptText,
} from "lucide-react";

import { cn } from "@/lib/utils";

const supplierNavItems = [
  { href: "/dashboard", label: "Gösterge Paneli", icon: LayoutDashboard },
  { href: "/vehicles", label: "Araçlar", icon: Truck },
  { href: "/drivers", label: "Şoförler", icon: Users },
  { href: "/shipments", label: "Seferler", icon: Package },
  { href: "/assign", label: "Atama", icon: ClipboardList },
  { href: "/contracts", label: "Sözleşmeler", icon: FileText },
  { href: "/pazaryeri", label: "Pazaryeri", icon: HandCoins },
  { href: "/tekliflerim", label: "Tekliflerim", icon: ReceiptText },
];

const customerNavItems = [
  { href: "/dashboard", label: "Gösterge Paneli", icon: LayoutDashboard },
  { href: "/shipments", label: "Seferlerim", icon: Package },
  { href: "/gate-guards", label: "Nizamiye", icon: ShieldCheck },
  { href: "/warehouses", label: "Depo & Rampa", icon: Warehouse },
  { href: "/consignees", label: "Cariler", icon: Contact },
  { href: "/blocked-drivers", label: "Engelli Sürücüler", icon: ShieldBan },
];

export function DashboardNav({
  companyType,
  companyRole,
  isPlatformAdmin,
}: {
  companyType: "SUPPLIER" | "CUSTOMER";
  companyRole: "ADMIN" | "MEMBER";
  isPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const baseItems =
    companyType === "SUPPLIER" ? supplierNavItems : customerNavItems;
  // Own-company settings (API key/webhook), ADMIN-only per company — see
  // /settings and requireAdmin in authorization.ts. Distinct from Yönetim
  // below, which is platform-wide, not per-company.
  const withSettings = companyRole === "ADMIN"
    ? [
        ...baseItems,
        { href: "/settings", label: "Ayarlar", icon: SlidersHorizontal },
      ]
    : baseItems;
  const items = isPlatformAdmin
    ? [...withSettings, { href: "/admin", label: "Yönetim", icon: Settings }]
    : withSettings;

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-brand text-brand-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:translate-x-0.5"
            )}
          >
            {/* Subtle active accent bar on the left edge. */}
            <span
              className={cn(
                "bg-brand-foreground absolute left-1 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full transition-opacity duration-200",
                isActive ? "opacity-70" : "opacity-0"
              )}
            />
            <Icon className="size-4 transition-transform duration-200 group-hover:scale-110" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
