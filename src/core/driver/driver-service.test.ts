import { afterAll, describe, expect, it } from "vitest";
import { compare } from "bcryptjs";

import * as driverService from "@/core/driver/driver-service";
import * as driverRepository from "@/core/driver/driver-repository";
import { ValidationError } from "@/core/shared/errors";
import {
  DriverDeactivationReason,
  DriverStatus,
} from "@/generated/prisma/client";
import {
  cleanupCompanies,
  createSupplierContext,
  createTestDriver,
  createTestUser,
} from "@/test/fixtures";

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

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
      licenseNumber: "SVCLIC001",
    });
    expect(created.fullName).toBe("Ahmet Yıldırım");

    await driverService.updateDriver(ctx, created.id, {
      fullName: "Ahmet Yıldırım",
      phone: "0532 888 88 88",
      licenseNumber: "SVCLIC001",
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
      licenseNumber: "LOGINLIC001",
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
      licenseNumber: "LOGINLIC002",
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
        licenseNumber: "LOGINLIC003",
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
        licenseNumber: "LOGINLIC004",
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
      licenseNumber: "LOGINLIC005",
      email: "keep-hash@test.local",
      password: "SuperSecret1!",
    });

    await driverService.updateDriver(ctx, driver.id, {
      fullName: "Keep Hash Driver",
      phone: "0532 111 22 37",
      licenseNumber: "LOGINLIC005",
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
      licenseNumber: "LOGINLIC006",
      email: "clear-login@test.local",
      password: "SuperSecret1!",
    });

    await driverService.updateDriver(ctx, driver.id, {
      fullName: "Clear Login Driver",
      phone: "0532 111 22 38",
      licenseNumber: "LOGINLIC006",
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
      licenseNumber: "LOGINLIC009",
      email: "revoke-token@test.local",
      password: "SuperSecret1!",
    });
    await driverService.regenerateDriverLoginToken(ctx, driver.id);

    await driverService.updateDriver(ctx, driver.id, {
      fullName: "Revoke Token Driver",
      phone: "0532 111 22 41",
      licenseNumber: "LOGINLIC009",
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
      licenseNumber: "LOGINLIC007",
    });

    await expect(
      driverService.updateDriver(ctx, driver.id, {
        fullName: "First Time Login Driver",
        phone: "0532 111 22 39",
        licenseNumber: "LOGINLIC007",
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

  it("revokes an active login-link token without touching email/password", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const driver = await createTestDriver(ctx.companyId, {
      email: "revoke-link@test.local",
    });
    await driverService.regenerateDriverLoginToken(ctx, driver.id);

    await driverService.revokeDriverLoginLink(ctx, driver.id);

    const updated = await driverService.getDriver(ctx, driver.id);
    expect(updated.loginToken).toBeNull();
    expect(updated.email).toBe("revoke-link@test.local");
  });
});

describe("driver-service: status, leave & deactivation (N2/N7)", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("toggles manual status Müsait ↔ Görevde Değil", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const driver = await createTestDriver(ctx.companyId);

    await driverService.setDriverStatus(ctx, driver.id, {
      status: DriverStatus.OFF_DUTY,
    });
    expect((await driverService.getDriver(ctx, driver.id)).status).toBe(
      DriverStatus.OFF_DUTY
    );

    await driverService.setDriverStatus(ctx, driver.id, {
      status: DriverStatus.AVAILABLE,
    });
    expect((await driverService.getDriver(ctx, driver.id)).status).toBe(
      DriverStatus.AVAILABLE
    );
  });

  it("refuses manual status change while the driver is on a trip", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const driver = await createTestDriver(ctx.companyId, {
      status: DriverStatus.ON_TRIP,
    });

    await expect(
      driverService.setDriverStatus(ctx, driver.id, {
        status: DriverStatus.OFF_DUTY,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("sets and clears a leave window, and rejects end-before-start", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const driver = await createTestDriver(ctx.companyId);

    await driverService.setDriverLeave(ctx, driver.id, {
      leaveStartDate: "2027-01-10",
      leaveEndDate: "2027-01-05",
    }).then(
      () => {
        throw new Error("should have rejected end-before-start");
      },
      (err) => expect(err).toBeInstanceOf(Error)
    );

    await driverService.setDriverLeave(ctx, driver.id, {
      leaveStartDate: "2027-01-05",
      leaveEndDate: "2027-01-10",
    });
    let saved = await driverService.getDriver(ctx, driver.id);
    expect(saved.leaveStartDate?.toISOString().slice(0, 10)).toBe("2027-01-05");
    expect(saved.leaveEndDate?.toISOString().slice(0, 10)).toBe("2027-01-10");

    await driverService.setDriverLeave(ctx, driver.id, {
      leaveStartDate: "",
      leaveEndDate: "",
    });
    saved = await driverService.getDriver(ctx, driver.id);
    expect(saved.leaveStartDate).toBeNull();
    expect(saved.leaveEndDate).toBeNull();
  });

  it("deactivates with a reason and reactivates, clearing the trail", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const driver = await createTestDriver(ctx.companyId);

    await driverService.deactivateDriver(ctx, driver.id, {
      reason: DriverDeactivationReason.HEALTH,
      note: "",
    });
    let saved = await driverService.getDriver(ctx, driver.id);
    expect(saved.isActive).toBe(false);
    expect(saved.deactivationReason).toBe(DriverDeactivationReason.HEALTH);
    expect(saved.deactivatedAt).not.toBeNull();

    // A deactivated driver can't have their day-to-day status hand-edited.
    await expect(
      driverService.setDriverStatus(ctx, driver.id, {
        status: DriverStatus.OFF_DUTY,
      })
    ).rejects.toThrow(ValidationError);

    await driverService.reactivateDriver(ctx, driver.id);
    saved = await driverService.getDriver(ctx, driver.id);
    expect(saved.isActive).toBe(true);
    expect(saved.deactivationReason).toBeNull();
    expect(saved.deactivatedAt).toBeNull();
  });

  it("requires a note when the deactivation reason is OTHER", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const driver = await createTestDriver(ctx.companyId);

    await expect(
      driverService.deactivateDriver(ctx, driver.id, {
        reason: DriverDeactivationReason.OTHER,
        note: "",
      })
    ).rejects.toThrow();
  });

  it("refuses to deactivate a driver who is on a trip", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const driver = await createTestDriver(ctx.companyId, {
      status: DriverStatus.ON_TRIP,
    });

    await expect(
      driverService.deactivateDriver(ctx, driver.id, {
        reason: DriverDeactivationReason.LEFT_JOB,
        note: "",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("assignableOnly excludes on-leave and deactivated drivers", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const free = await createTestDriver(ctx.companyId);
    const onLeave = await createTestDriver(ctx.companyId, {
      leaveStartDate: daysFromNow(-1),
      leaveEndDate: daysFromNow(2),
    });
    const deactivated = await createTestDriver(ctx.companyId, {
      isActive: false,
    });

    const assignable = await driverRepository.listDriversForTenant(ctx, {
      status: DriverStatus.AVAILABLE,
      assignableOnly: true,
    });
    const ids = assignable.map((d) => d.id);
    expect(ids).toContain(free.id);
    expect(ids).not.toContain(onLeave.id);
    expect(ids).not.toContain(deactivated.id);
  });
});
