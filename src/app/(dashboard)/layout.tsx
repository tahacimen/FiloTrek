import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard/nav";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Logo } from "@/components/logo";
import { companyTypeLabels } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { listRecentNotifications } from "@/core/notification/notification-service";
import type { TenantContext } from "@/core/shared/tenant-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // proxy.ts already keeps driver sessions out of (dashboard) routes — this
  // is defense-in-depth, since Server Components aren't guaranteed to run
  // behind proxy.ts on every request. This file calls auth() directly
  // (rather than requireTenantContext()) because it also needs
  // companyName/name for display, which that function doesn't return.
  if (!session?.user || session.user.accountType !== "COMPANY_USER") {
    redirect("/login");
  }
  const user = session.user;

  // Both roles receive notifications now: suppliers get SHIPMENT_REQUESTED /
  // LOAD_READY, customers get VEHICLE_DEPARTED.
  const notificationFeed = await listRecentNotifications({
    userId: user.id,
    companyId: user.companyId,
    companyType: user.companyType,
    companyRole: user.companyRole,
  } satisfies TenantContext);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
        <div className="flex items-center gap-2 border-b px-4 py-3.5">
          <Link href="/dashboard">
            <Logo className="h-8 w-auto" />
          </Link>
        </div>
        <DashboardNav companyType={user.companyType} />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-2.5 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Logo className="h-7 w-auto" />
          </div>
          <Badge variant="outline" className="hidden md:inline-flex">
            {companyTypeLabels[user.companyType]}
          </Badge>
          <div className="flex items-center gap-1">
            <NotificationBell initialFeed={notificationFeed} />
            <UserMenu userName={user.name ?? ""} companyName={user.companyName} />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
