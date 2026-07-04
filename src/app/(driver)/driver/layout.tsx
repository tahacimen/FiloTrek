import { requireDriverContext } from "@/core/shared/driver-context";
import { getCompanyById } from "@/core/company/company-repository";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Logo } from "@/components/logo";

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // proxy.ts already keeps company-user sessions out of /driver — this call
  // is the defense-in-depth layer, same rationale as (dashboard)/layout.tsx.
  const driverCtx = await requireDriverContext();
  const company = await getCompanyById(driverCtx.companyId);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2.5 md:px-6">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-auto" />
        </div>
        <UserMenu
          userName={driverCtx.fullName}
          companyName={company?.name ?? "Tedarikçi"}
        />
      </header>
      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
