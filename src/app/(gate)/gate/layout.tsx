import { requireGateGuardContext } from "@/core/shared/gate-guard-context";
import { getCompanyById } from "@/core/company/company-repository";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Logo } from "@/components/logo";

export default async function GateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // proxy.ts already keeps other account types out of /gate — this call is
  // the defense-in-depth layer, same rationale as (driver)/driver/layout.tsx.
  const gateGuardCtx = await requireGateGuardContext();
  const company = await getCompanyById(gateGuardCtx.companyId);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2.5 md:px-6">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-auto" />
          <span className="text-muted-foreground font-semibold">Nizamiye</span>
        </div>
        <UserMenu
          userName={gateGuardCtx.fullName}
          companyName={company?.name ?? "Müşteri"}
        />
      </header>
      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
