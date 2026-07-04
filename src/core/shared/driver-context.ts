import { auth } from "@/lib/auth";
import { UnauthorizedError } from "@/core/shared/errors";

/**
 * Deliberately structurally distinct from TenantContext (no companyRole,
 * has driverId) — passing the wrong context into the wrong function (e.g.
 * requireCompanyType, or advanceShipmentStatus vs advanceShipmentStatusAsDriver)
 * must be a compile error, not something DRY-ing these two types together
 * would silently allow through.
 */
export type DriverContext = {
  driverId: string;
  companyId: string;
  fullName: string;
};

/**
 * Same rationale as requireTenantContext in ./tenant-context.ts: called
 * directly at the top of every driver-facing Server Action/page, never
 * trusting proxy.ts alone (Next.js doesn't guarantee proxy runs for every
 * Server Function invocation).
 */
export async function requireDriverContext(): Promise<DriverContext> {
  const session = await auth();
  if (!session?.user || session.user.accountType !== "DRIVER") {
    throw new UnauthorizedError("Bu işlem için giriş yapmanız gerekiyor.");
  }

  return {
    driverId: session.user.driverId,
    companyId: session.user.companyId,
    fullName: session.user.name ?? "",
  };
}
