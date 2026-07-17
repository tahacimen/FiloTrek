import { afterAll, describe, expect, it } from "vitest";

import * as companyService from "@/core/company/company-service";
import { UnauthorizedError } from "@/core/shared/errors";
import { cleanupCompanies, createSupplierContext } from "@/test/fixtures";
import type { TenantContext } from "@/core/shared/tenant-context";

function asMember(ctx: TenantContext): TenantContext {
  return { ...ctx, companyRole: "MEMBER" };
}

describe("company-service: settings", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("reports no key/webhook configured for a brand-new company", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    const settings = await companyService.getCompanySettings(ctx);

    expect(settings.hasApiKey).toBe(false);
    expect(settings.webhookUrl).toBeNull();
    expect(settings.hasWebhookSecret).toBe(false);
  });

  it("generateApiKey returns the plaintext key once and persists it", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    const apiKey = await companyService.generateApiKey(ctx);
    expect(typeof apiKey).toBe("string");
    expect(apiKey.length).toBeGreaterThan(20);

    const settings = await companyService.getCompanySettings(ctx);
    expect(settings.hasApiKey).toBe(true);
  });

  it("regenerating the API key produces a different value each time", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    const first = await companyService.generateApiKey(ctx);
    const second = await companyService.generateApiKey(ctx);

    expect(first).not.toBe(second);
  });

  it("setWebhookUrl stores and later clears the URL", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    await companyService.setWebhookUrl(ctx, {
      webhookUrl: "https://example.com/webhooks/logigo",
    });
    let settings = await companyService.getCompanySettings(ctx);
    expect(settings.webhookUrl).toBe("https://example.com/webhooks/logigo");

    await companyService.setWebhookUrl(ctx, {});
    settings = await companyService.getCompanySettings(ctx);
    expect(settings.webhookUrl).toBeNull();
  });

  it("rejects a non-http(s) webhook URL", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    await expect(
      companyService.setWebhookUrl(ctx, { webhookUrl: "javascript:alert(1)" })
    ).rejects.toThrow();
  });

  it("generateWebhookSecret returns the plaintext secret once and persists it", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    const secret = await companyService.generateWebhookSecret(ctx);
    expect(typeof secret).toBe("string");

    const settings = await companyService.getCompanySettings(ctx);
    expect(settings.hasWebhookSecret).toBe(true);
  });

  it("rejects a non-ADMIN company user for every settings operation", async () => {
    const ctx = asMember(await createSupplierContext());
    companyIds.push(ctx.companyId);

    await expect(companyService.getCompanySettings(ctx)).rejects.toThrow(
      UnauthorizedError
    );
    await expect(companyService.generateApiKey(ctx)).rejects.toThrow(
      UnauthorizedError
    );
    await expect(
      companyService.setWebhookUrl(ctx, { webhookUrl: "https://example.com" })
    ).rejects.toThrow(UnauthorizedError);
    await expect(companyService.generateWebhookSecret(ctx)).rejects.toThrow(
      UnauthorizedError
    );
  });
});
