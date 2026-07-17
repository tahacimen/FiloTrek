import * as companyRepository from "@/core/company/company-repository";
import { requireAdmin } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { generateSecureToken } from "@/lib/tokens";
import { webhookUrlInputSchema } from "@/lib/validation/company";

/** ADMIN-only, self-service settings for a company's own /api/v1 access and outbound webhook — see /settings. */
export async function getCompanySettings(ctx: TenantContext) {
  requireAdmin(ctx);
  const company = await companyRepository.getCompanyById(ctx.companyId);
  return {
    hasApiKey: !!company?.apiKey,
    webhookUrl: company?.webhookUrl ?? null,
    hasWebhookSecret: !!company?.webhookSecret,
  };
}

/** Returns the plaintext key — the ONLY time it's ever available in full; only a hasApiKey boolean is readable afterward. */
export async function generateApiKey(ctx: TenantContext): Promise<string> {
  requireAdmin(ctx);
  const apiKey = generateSecureToken();
  await companyRepository.setApiKey(ctx.companyId, apiKey);
  return apiKey;
}

export async function setWebhookUrl(ctx: TenantContext, rawInput: unknown) {
  requireAdmin(ctx);
  const input = webhookUrlInputSchema.parse(rawInput);
  await companyRepository.setWebhookUrl(ctx.companyId, input.webhookUrl ?? null);
}

/** Same shown-once convention as generateApiKey. */
export async function generateWebhookSecret(ctx: TenantContext): Promise<string> {
  requireAdmin(ctx);
  const secret = generateSecureToken();
  await companyRepository.setWebhookSecret(ctx.companyId, secret);
  return secret;
}
