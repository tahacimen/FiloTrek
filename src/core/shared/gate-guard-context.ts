import { auth } from "@/lib/auth";
import { UnauthorizedError } from "@/core/shared/errors";

/**
 * Deliberately structurally distinct from TenantContext/DriverContext (no
 * companyRole, has gateGuardId) — same rationale as DriverContext: passing
 * the wrong context into the wrong function must be a compile error.
 */
export type GateGuardContext = {
  gateGuardId: string;
  companyId: string;
  fullName: string;
};

/**
 * Same rationale as requireTenantContext/requireDriverContext: called
 * directly at the top of every gate-facing Server Action/page, never
 * trusting proxy.ts alone (Next.js doesn't guarantee proxy runs for every
 * Server Function invocation).
 */
export async function requireGateGuardContext(): Promise<GateGuardContext> {
  const session = await auth();
  if (!session?.user || session.user.accountType !== "GATE_GUARD") {
    throw new UnauthorizedError("Bu işlem için giriş yapmanız gerekiyor.");
  }

  return {
    gateGuardId: session.user.gateGuardId,
    companyId: session.user.companyId,
    fullName: session.user.name ?? "",
  };
}
