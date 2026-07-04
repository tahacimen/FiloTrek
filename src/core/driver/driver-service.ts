import { hash } from "bcryptjs";

import { prisma } from "@/lib/db";
import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import * as driverRepository from "@/core/driver/driver-repository";
import { driverInputSchema } from "@/lib/validation/driver";
import { generateLoginToken } from "@/lib/tokens";
import { CompanyType, DriverStatus } from "@/generated/prisma/client";

export async function listDrivers(
  ctx: TenantContext,
  filter?: { status?: DriverStatus }
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  return driverRepository.listDriversForTenant(ctx, filter);
}

export async function getDriver(ctx: TenantContext, driverId: string) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const driver = await driverRepository.getDriverForTenant(ctx, driverId);
  if (!driver) throw new NotFoundError("Şoför bulunamadı.");
  return driver;
}

async function assertEmailNotUsedByCompanyUser(email: string) {
  if (await driverRepository.isEmailUsedByCompanyUser(email)) {
    throw new ValidationError(
      `${email} adresi zaten bir şirket kullanıcısı tarafından kullanılıyor.`
    );
  }
}

export async function createDriver(ctx: TenantContext, rawInput: unknown) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const input = driverInputSchema.parse(rawInput);

  const existing = await driverRepository.findDriverByLicenseNumber(
    input.licenseNumber
  );
  if (existing) {
    throw new ValidationError(
      `${input.licenseNumber} ehliyet numaralı şoför zaten sistemde kayıtlı.`
    );
  }

  const { password, email, tcNumber, experienceYears, ...rest } = input;
  let passwordHash: string | null = null;
  if (email) {
    if (!password) {
      throw new ValidationError(
        "Giriş için e-posta girildiyse şifre de girilmelidir."
      );
    }
    await assertEmailNotUsedByCompanyUser(email);
    passwordHash = await hash(password, 10);
  }

  return driverRepository.createDriverRecord(ctx, {
    ...rest,
    email: email ?? null,
    passwordHash,
    tcNumber: tcNumber ?? null,
    experienceYears: experienceYears ?? null,
  });
}

export async function updateDriver(
  ctx: TenantContext,
  driverId: string,
  rawInput: unknown
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const input = driverInputSchema.parse(rawInput);

  const existing = await driverRepository.getDriverForTenant(ctx, driverId);
  if (!existing) throw new NotFoundError("Şoför bulunamadı.");

  if (input.licenseNumber !== existing.licenseNumber) {
    const licenseOwner = await driverRepository.findDriverByLicenseNumber(
      input.licenseNumber
    );
    if (licenseOwner) {
      throw new ValidationError(
        `${input.licenseNumber} ehliyet numaralı şoför zaten sistemde kayıtlı.`
      );
    }
  }

  const { password, email, tcNumber, experienceYears, ...rest } = input;
  // undefined means "leave the field untouched" — blank password on edit
  // keeps the existing credential rather than wiping it.
  let passwordHash: string | null | undefined;
  let loginToken: string | null | undefined;
  if (email) {
    if (password) {
      passwordHash = await hash(password, 10);
    } else if (!existing.passwordHash) {
      throw new ValidationError(
        "Bu şoför için giriş bilgisi ilk kez tanımlanıyorsa şifre girilmelidir."
      );
    }
    if (email !== existing.email) {
      await assertEmailNotUsedByCompanyUser(email);
    }
  } else {
    // Email field left blank — clears login capability entirely (both the
    // password and any previously sent login link), matching what an empty
    // field naturally communicates on the form.
    passwordHash = null;
    loginToken = null;
  }

  await driverRepository.updateDriverRecord(ctx, driverId, {
    ...rest,
    email: email ?? null,
    ...(passwordHash !== undefined ? { passwordHash } : {}),
    ...(loginToken !== undefined ? { loginToken } : {}),
    tcNumber: tcNumber ?? null,
    experienceYears: experienceYears ?? null,
  });
}

export async function deleteDriver(ctx: TenantContext, driverId: string) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);

  const existing = await driverRepository.getDriverForTenant(ctx, driverId);
  if (!existing) throw new NotFoundError("Şoför bulunamadı.");

  if (existing.status === DriverStatus.ON_TRIP) {
    throw new ValidationError(
      "Aktif seferde olan bir şoför silinemez. Önce seferi tamamlayın veya iptal edin."
    );
  }

  try {
    await driverRepository.deleteDriverRecord(ctx, driverId);
  } catch {
    throw new ValidationError(
      "Bu şoförün sefer geçmişi bulunduğu için silinemiyor."
    );
  }
}

/**
 * Issues a fresh bearer token for the driver's login link, invalidating any
 * previously sent one — same "resend rotates" convention as a password
 * reset link, applied here since re-sending is also how a dispatcher would
 * revoke a link they suspect leaked.
 */
export async function regenerateDriverLoginToken(
  ctx: TenantContext,
  driverId: string
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const existing = await driverRepository.getDriverForTenant(ctx, driverId);
  if (!existing) throw new NotFoundError("Şoför bulunamadı.");
  if (!existing.email) {
    throw new ValidationError(
      "Bağlantı gönderebilmek için önce şoförün e-posta adresi tanımlanmalı."
    );
  }

  const token = generateLoginToken();
  await driverRepository.setDriverLoginToken(ctx, driverId, token);
  return { token, email: existing.email, fullName: existing.fullName };
}

export async function getDriverStatusCounts(ctx: TenantContext) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const groups = await driverRepository.countDriversByStatus(ctx);
  return groups.reduce(
    (acc, g) => {
      acc[g.status] = g._count;
      return acc;
    },
    {} as Record<DriverStatus, number>
  );
}

// Used by shipment-service to validate/lock a driver inside a transaction.
export async function assertDriverAvailableForAssignment(
  tx: typeof prisma,
  ctx: TenantContext,
  driverId: string
) {
  const driver = await tx.driver.findFirst({
    where: { id: driverId, companyId: ctx.companyId },
  });
  if (!driver) throw new NotFoundError("Şoför bulunamadı.");
  if (driver.status !== DriverStatus.AVAILABLE) {
    throw new ValidationError("Seçilen şoför şu anda müsait değil.");
  }
  return driver;
}
