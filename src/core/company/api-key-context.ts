import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/core/shared/errors";
import type { CompanyType } from "@/generated/prisma/client";

export type ApiKeyContext = {
  companyId: string;
  companyType: CompanyType;
};

/**
 * Read-only, API-key-based counterpart to TenantContext (see
 * core/shared/tenant-context.ts) — used exclusively by the public
 * /api/v1 routes, resolved from an `Authorization: Bearer <api_key>`
 * header instead of a session cookie. A company generates/rotates its own
 * key from /settings (see company-service.ts).
 */
export async function requireApiKeyContext(request: Request): Promise<ApiKeyContext> {
  const authHeader = request.headers.get("authorization");
  const apiKey =
    authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!apiKey) {
    throw new UnauthorizedError("Authorization: Bearer <api_key> başlığı gerekli.");
  }

  const company = await prisma.company.findUnique({
    where: { apiKey },
    select: { id: true, type: true },
  });
  if (!company) {
    throw new UnauthorizedError("Geçersiz API anahtarı.");
  }

  return { companyId: company.id, companyType: company.type };
}
