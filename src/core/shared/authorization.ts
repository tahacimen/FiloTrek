import { CompanyRole, CompanyType } from "@/generated/prisma/enums";
import { UnauthorizedError } from "@/core/shared/errors";
import type { TenantContext } from "@/core/shared/tenant-context";

/**
 * Pure authorization checks against an already-resolved TenantContext.
 * Deliberately has no dependency on next-auth/Next.js request context (only
 * the lightweight enum module) so services can be unit/integration tested
 * without booting the full Auth.js config.
 */
export function requireCompanyType(ctx: TenantContext, type: CompanyType) {
  if (ctx.companyType !== type) {
    throw new UnauthorizedError(
      type === CompanyType.SUPPLIER
        ? "Bu işlem yalnızca tedarikçi firmalar tarafından yapılabilir."
        : "Bu işlem yalnızca müşteri firmalar tarafından yapılabilir."
    );
  }
}

export function requireAdmin(ctx: TenantContext) {
  if (ctx.companyRole !== CompanyRole.ADMIN) {
    throw new UnauthorizedError("Bu işlem için yönetici yetkisi gerekiyor.");
  }
}

/**
 * Platform-wide, not per-company — gates /admin (invitation management).
 * ctx.isPlatformAdmin only ever comes from the User row's own isPlatformAdmin
 * column (see schema.prisma), which nothing in the app can set; it's flipped
 * directly in the DB by the site owner.
 */
export function requirePlatformAdmin(ctx: TenantContext) {
  if (!ctx.isPlatformAdmin) {
    throw new UnauthorizedError("Bu işlem için platform yöneticisi yetkisi gerekiyor.");
  }
}
