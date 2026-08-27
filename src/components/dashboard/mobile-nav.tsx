"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { Logo } from "@/components/logo";
import { DashboardNav } from "@/components/dashboard/nav";

/**
 * The mobile counterpart to the md:+ sidebar: a hamburger that opens a
 * slide-in drawer holding the same DashboardNav. Without this the whole
 * navigation is unreachable on phones (the <aside> is hidden below md).
 * Closes on route change and on overlay/close tap; locks body scroll while open.
 */
export function MobileNav({
  companyType,
  companyRole,
  isPlatformAdmin,
}: {
  companyType: "SUPPLIER" | "CUSTOMER";
  companyRole: "ADMIN" | "MEMBER";
  isPlatformAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menüyü aç"
        className="hover:bg-accent -ml-1 flex size-9 items-center justify-center rounded-lg transition-colors"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Menüyü kapat"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="bg-background absolute top-0 left-0 flex h-full w-72 max-w-[82vw] flex-col shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3.5">
              <Logo className="h-8 w-auto" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Kapat"
                className="hover:bg-accent flex size-9 items-center justify-center rounded-lg transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <DashboardNav
                companyType={companyType}
                companyRole={companyRole}
                isPlatformAdmin={isPlatformAdmin}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
