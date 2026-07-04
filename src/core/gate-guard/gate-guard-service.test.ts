import { afterAll, describe, expect, it } from "vitest";
import { compare } from "bcryptjs";

import * as gateGuardService from "@/core/gate-guard/gate-guard-service";
import { UnauthorizedError, ValidationError } from "@/core/shared/errors";
import {
  cleanupCompanies,
  createCustomerContext,
  createSupplierContext,
  createTestDriver,
  createTestUser,
} from "@/test/fixtures";

describe("gate-guard-service", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("creates, edits and deletes a gate guard end-to-end", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);

    const created = await gateGuardService.createGateGuard(ctx, {
      fullName: "Nizamiye Görevlisi",
      email: "nizamiye1@test.local",
      password: "SuperSecret1!",
    });
    expect(created.fullName).toBe("Nizamiye Görevlisi");
    expect(created.passwordHash).not.toBe("SuperSecret1!");
    expect(await compare("SuperSecret1!", created.passwordHash)).toBe(true);

    await gateGuardService.updateGateGuard(ctx, created.id, {
      fullName: "Nizamiye Görevlisi 2",
      email: "nizamiye1@test.local",
    });
    const edited = await gateGuardService.getGateGuard(ctx, created.id);
    expect(edited.fullName).toBe("Nizamiye Görevlisi 2");
    // Blank password on edit keeps the existing hash.
    expect(await compare("SuperSecret1!", edited.passwordHash)).toBe(true);

    await gateGuardService.deleteGateGuard(ctx, created.id);
    await expect(
      gateGuardService.getGateGuard(ctx, created.id)
    ).rejects.toThrow();
  });

  it("rejects a SUPPLIER-role caller", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    await expect(
      gateGuardService.createGateGuard(ctx, {
        fullName: "Nizamiye Görevlisi",
        email: "nizamiye2@test.local",
        password: "SuperSecret1!",
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it("requires a password when creating a new gate guard", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);

    await expect(
      gateGuardService.createGateGuard(ctx, {
        fullName: "Nizamiye Görevlisi",
        email: "nizamiye3@test.local",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects an email already used by a company User", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);
    const user = await createTestUser(ctx.companyId);

    await expect(
      gateGuardService.createGateGuard(ctx, {
        fullName: "Nizamiye Görevlisi",
        email: user.email,
        password: "SuperSecret1!",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects an email already used by a Driver", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);
    const driver = await createTestDriver(supplierCtx.companyId, {
      email: "shared-with-driver@test.local",
    });

    await expect(
      gateGuardService.createGateGuard(customerCtx, {
        fullName: "Nizamiye Görevlisi",
        email: driver.email!,
        password: "SuperSecret1!",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("never returns another company's gate guards (tenant isolation)", async () => {
    const ctxA = await createCustomerContext();
    const ctxB = await createCustomerContext();
    companyIds.push(ctxA.companyId, ctxB.companyId);
    await gateGuardService.createGateGuard(ctxA, {
      fullName: "A Nizamiye",
      email: "isolation-a@test.local",
      password: "SuperSecret1!",
    });

    const listA = await gateGuardService.listGateGuards(ctxA);
    const listB = await gateGuardService.listGateGuards(ctxB);
    expect(listA).toHaveLength(1);
    expect(listB).toHaveLength(0);
  });
});
