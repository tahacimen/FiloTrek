"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  Users,
  Package,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";

const supplierNavItems = [
  { href: "/dashboard", label: "Gösterge Paneli", icon: LayoutDashboard },
  { href: "/vehicles", label: "Araçlar", icon: Truck },
  { href: "/drivers", label: "Şoförler", icon: Users },
  { href: "/shipments", label: "Seferler", icon: Package },
  { href: "/assign", label: "Atama", icon: ClipboardList },
];

const customerNavItems = [
  { href: "/dashboard", label: "Gösterge Paneli", icon: LayoutDashboard },
  { href: "/shipments", label: "Seferlerim", icon: Package },
  { href: "/gate-guards", label: "Nizamiye", icon: ShieldCheck },
];

export function DashboardNav({
  companyType,
}: {
  companyType: "SUPPLIER" | "CUSTOMER";
}) {
  const pathname = usePathname();
  const items = companyType === "SUPPLIER" ? supplierNavItems : customerNavItems;

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
              "flex items-center gap-2.5 rounded-md border-l-[3px] px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary bg-primary/8 text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
