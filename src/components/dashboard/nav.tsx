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
  Warehouse,
  HandCoins,
} from "lucide-react";

import { cn } from "@/lib/utils";

const supplierNavItems = [
  { href: "/dashboard", label: "Gösterge Paneli", icon: LayoutDashboard },
  { href: "/vehicles", label: "Araçlar", icon: Truck },
  { href: "/drivers", label: "Şoförler", icon: Users },
  { href: "/shipments", label: "Seferler", icon: Package },
  { href: "/assign", label: "Atama", icon: ClipboardList },
  { href: "/pazaryeri", label: "Pazaryeri", icon: HandCoins },
];

const customerNavItems = [
  { href: "/dashboard", label: "Gösterge Paneli", icon: LayoutDashboard },
  { href: "/shipments", label: "Seferlerim", icon: Package },
  { href: "/gate-guards", label: "Nizamiye", icon: ShieldCheck },
  { href: "/warehouses", label: "Depo & Rampa", icon: Warehouse },
];

export function DashboardNav({
  companyType,
  isPlatformAdmin,
}: {
  companyType: "SUPPLIER" | "CUSTOMER";
  isPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const baseItems =
    companyType === "SUPPLIER" ? supplierNavItems : customerNavItems;
  // Platform-wide, not per-company — visible regardless of companyType (see
  // requirePlatformAdmin in authorization.ts).
  const items = isPlatformAdmin
    ? [...baseItems, { href: "/admin", label: "Yönetim", icon: Settings }]
    : baseItems;

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
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand text-brand-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
