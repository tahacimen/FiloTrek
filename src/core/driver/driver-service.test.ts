import { afterAll, describe, expect, it } from "vitest";
import { compare } from "bcryptjs";

import * as driverService from "@/core/driver/driver-service";
import { ValidationError } from "@/core/shared/errors";
import {
  cleanupCompanies,
  createSupplierContext,
  createTestDriver,
  createTestUser,
} from "@/test/fixtures";

describe("driver-service", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("creates, edits and deletes a driver end-to-end", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    const created = await driverService.createDriver(ctx, {
      fullName: "Ahmet Yıldırım",
      phone: "0532 999 99 99",
      licenseNumber: "SVC-LIC-001",
    });
    expect(created.fullName).toBe("Ahmet Yıldırım");

    await driverService.updateDriver(ctx, created.id, {
      fullName: "Ahmet Yıldırım",
      phone: "0532 888 88 88",
      licenseNumber: "SVC-LIC-001",
    });
    const edited = await driverService.getDriver(ctx, created.id);
    expect(edited.phone).toBe("0532 888 88 88");

    await driverService.deleteDriver(ctx, created.id);
    await expect(driverService.getDriver(ctx, created.id)).rejects.toThrow();
  });

  it("rejects creating a driver with a license number already used by another company", async () => {
    const ctxA = await createSupplierContext();
    const ctxB = await createSupplierContext();
    companyIds.push(ctxA.companyId, ctxB.companyId);
    await createTestDriver(ctxA.companyId);
    const existing = await driverService.listDrivers(ctxA);

    await expect(
      driverService.createDriver(ctxB, {
        fullName: "Duplicate License Driver",
        phone: "0532 000 00 00",
        licenseNumber: existing[0].licenseNumber,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("refuses to delete a driver that is currently ON_TRIP", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const driver = await createTestDriver(ctx.companyId, { status: "ON_TRIP" });

    await expect(driverService.deleteDriver(ctx, driver.id)).rejects.toThrow(
      ValidationError
    );
  });
});

describe("driver-service: login credentials (email/password)", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("creates a driver with login credentials, hashing the password", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    const driver = await driverService.createDriver(ctx, {
      fullName: "Login Driver",
      phone: "0532 111 22 33",
      licenseNumber: "LOGIN-LIC-001",
      email: "login-driver@test.local",
      password: "SuperSecret1!",
    });

    expect(driver.email).toBe("login-driver@test.local");
    expect(driver.passwordHash).not.toBeNull();
    expect(driver.passwordHash).not.toBe("SuperSecret1!");
    expect(await compare("SuperSecret1!", driver.passwordHash!)).toBe(true);
  });

  it("creates a driver with no login capability when email is omitted", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    const driver = await driverService.createDriver(ctx, {
      fullName: "No Login Driver",
      phone: "0532 111 22 34",
      licenseNumber: "LOGIN-LIC-002",
    });

    expect(driver.email).toBeNull();
    expect(driver.passwordHash).toBeNull();
  });

  it("rejects creating a driver with an email but no password", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    await expect(
      driverService.createDriver(ctx, {
        fullName: "Missing Password Driver",
        phone: "0532 111 22 35",
        licenseNumber: "LOGIN-LIC-003",
        email: "missing-password@test.local",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a driver email already used by a company User", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const user = await createTestUser(ctx.companyId);

    await expect(
      driverService.createDriver(ctx, {
        fullName: "Colliding Email Driver",
        phone: "0532 111 22 36",
        licenseNumber: "LOGIN-LIC-004",
        email: user.email,
        password: "SuperSecret1!",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("update: blank password on edit keeps the existing hash", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const driver = await driverService.createDriver(ctx, {
      fullName: "Keep Hash Driver",
      phone: "0532 111 22 37",
      licenseNumber: "LOGIN-LIC-005",
      email: "keep-hash@test.local",
      password: "SuperSecret1!",
    });

    await driverService.updateDriver(ctx, driver.id, {
      fullName: "Keep Hash Driver",
      phone: "0532 111 22 37",
      licenseNumber: "LOGIN-LIC-005",
      email: "keep-hash@test.local",
      // password intentionally omitted
    });

    const updated = await driverService.getDriver(ctx, driver.id);
    expect(await compare("SuperSecret1!", updated.passwordHash!)).toBe(true);
  });

  it("update: blank email clears login capability entirely", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const driver = await driverService.createDriver(ctx, {
      fullName: "Clear Login Driver",
      phone: "0532 111 22 38",
      licenseNumber: "LOGIN-LIC-006",
      email: "clear-login@test.local",
      password: "SuperSecret1!",
    });

    await driverService.updateDriver(ctx, driver.id, {
      fullName: "Clear Login Driver",
      phone: "0532 111 22 38",
      licenseNumber: "LOGIN-LIC-006",
      // email intentionally omitted
    });

    const updated = await driverService.getDriver(ctx, driver.id);
    expect(updated.email).toBeNull();
    expect(updated.passwordHash).toBeNull();
  });

  it("update: blank email also revokes a previously issued login-link token", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const driver = await driverService.createDriver(ctx, {
      fullName: "Revoke Token Driver",
      phone: "0532 111 22 41",
      licenseNumber: "LOGIN-LIC-009",
      email: "revoke-token@test.local",
      password: "SuperSecret1!",
    });
    await driverService.regenerateDriverLoginToken(ctx, driver.id);

    await driverService.updateDriver(ctx, driver.id, {
      fullName: "Revoke Token Driver",
      phone: "0532 111 22 41",
      licenseNumber: "LOGIN-LIC-009",
      // email intentionally omitted
    });

    const updated = await driverService.getDriver(ctx, driver.id);
    expect(updated.loginToken).toBeNull();
  });

  it("update: requires a password the first time login is enabled via edit", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const driver = await driverService.createDriver(ctx, {
      fullName: "First Time Login Driver",
      phone: "0532 111 22 39",
      licenseNumber: "LOGIN-LIC-007",
    });

    await expect(
      driverService.updateDriver(ctx, driver.id, {
        fullName: "First Time Login Driver",
        phone: "0532 111 22 39",
        licenseNumber: "LOGIN-LIC-007",
        email: "first-time@test.local",
        // password intentionally omitted — this driver never had a hash yet
      })
    ).rejects.toThrow(ValidationError);
  });
});

describe("driver-service: login link", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("issues a login-link token for a driver with email set", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const driver = await createTestDriver(ctx.companyId, {
      email: "link-driver@test.local",
    });

    const result = await driverService.regenerateDriverLoginToken(
      ctx,
      driver.id
    );

    expect(result.token).toEqual(expect.any(String));
    expect(result.token.length).toBeGreaterThan(20);
    expect(result.email).toBe("link-driver@test.local");
    const updated = await driverService.getDriver(ctx, driver.id);
    expect(updated.loginToken).toBe(result.token);
  });

  it("rotates the token on every call, invalidating the previous one", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const driver = await createTestDriver(ctx.companyId, {
      email: "rotate-driver@test.local",
    });

    const first = await driverService.regenerateDriverLoginToken(
      ctx,
      driver.id
    );
    const second = await driverService.regenerateDriverLoginToken(
      ctx,
      driver.id
    );

    expect(second.token).not.toBe(first.token);
    const updated = await driverService.getDriver(ctx, driver.id);
    expect(updated.loginToken).toBe(second.token);
  });

  it("rejects issuing a login link for a driver with no email", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const driver = await createTestDriver(ctx.companyId);

    await expect(
      driverService.regenerateDriverLoginToken(ctx, driver.id)
    ).rejects.toThrow(ValidationError);
  });
});
