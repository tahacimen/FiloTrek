import { auth } from "@/lib/auth";
import { CompanyRole, CompanyType } from "@/generated/prisma/client";
import { UnauthorizedError } from "@/core/shared/errors";

export type TenantContext = {
  userId: string;
  companyId: string;
  companyType: CompanyType;
  companyRole: CompanyRole;
  isPlatformAdmin: boolean;
};

/**
 * Derives the tenant context directly from the session on every call.
 * Every Server Action / route handler must call this itself rather than
 * trust proxy.ts — Next.js does not guarantee proxy runs for every Server
 * Function invocation (see https://nextjs.org/docs/app/guides/data-security).
 *
 * Authorization checks against an already-resolved context (requireCompanyType,
 * requireAdmin) live in ./authorization.ts instead — that module has no
 * next-auth dependency, so services built on it stay testable without booting
 * the full Auth.js config.
 */
export async function requireTenantContext(): Promise<TenantContext> {
  const session = await auth();
  if (!session?.user || session.user.accountType !== "COMPANY_USER") {
    throw new UnauthorizedError("Bu işlem için giriş yapmanız gerekiyor.");
  }

  return {
    userId: session.user.id,
    companyId: session.user.companyId,
    companyType: session.user.companyType,
    companyRole: session.user.companyRole,
    isPlatformAdmin: session.user.isPlatformAdmin,
  };
}
