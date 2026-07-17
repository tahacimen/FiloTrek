import { afterAll, describe, expect, it } from "vitest";

import { requireApiKeyContext } from "@/core/company/api-key-context";
import * as companyService from "@/core/company/company-service";
import { UnauthorizedError } from "@/core/shared/errors";
import { cleanupCompanies, createSupplierContext } from "@/test/fixtures";

function requestWithBearer(token: string | null) {
  const headers = new Headers();
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  return new Request("https://example.com/api/v1/shipments", { headers });
}

describe("requireApiKeyContext", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("resolves the company for a valid API key", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const apiKey = await companyService.generateApiKey(ctx);

    const apiKeyCtx = await requireApiKeyContext(requestWithBearer(apiKey));

    expect(apiKeyCtx.companyId).toBe(ctx.companyId);
    expect(apiKeyCtx.companyType).toBe("SUPPLIER");
  });

  it("rejects a missing Authorization header", async () => {
    await expect(
      requireApiKeyContext(requestWithBearer(null))
    ).rejects.toThrow(UnauthorizedError);
  });

  it("rejects an unknown API key", async () => {
    await expect(
      requireApiKeyContext(requestWithBearer("not-a-real-key"))
    ).rejects.toThrow(UnauthorizedError);
  });

  it("rejects a non-Bearer Authorization header", async () => {
    const headers = new Headers({ authorization: "Basic dXNlcjpwYXNz" });
    const request = new Request("https://example.com/api/v1/shipments", {
      headers,
    });

    await expect(requireApiKeyContext(request)).rejects.toThrow(
      UnauthorizedError
    );
  });
});
