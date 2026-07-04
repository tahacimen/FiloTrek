import { hash } from "bcryptjs";

import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import * as gateGuardRepository from "@/core/gate-guard/gate-guard-repository";
import { gateGuardInputSchema } from "@/lib/validation/gate-guard";
import { CompanyType } from "@/generated/prisma/client";

export async function listGateGuards(ctx: TenantContext) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  return gateGuardRepository.listGateGuardsForTenant(ctx);
}

export async function getGateGuard(ctx: TenantContext, gateGuardId: string) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const gateGuard = await gateGuardRepository.getGateGuardForTenant(
    ctx,
    gateGuardId
  );
  if (!gateGuard) throw new NotFoundError("Nizamiye kullanıcısı bulunamadı.");
  return gateGuard;
}

async function assertEmailNotUsedElsewhere(email: string) {
  if (await gateGuardRepository.isEmailUsedByUserOrDriver(email)) {
    throw new ValidationError(
      `${email} adresi zaten başka bir kullanıcı tarafından kullanılıyor.`
    );
  }
}

export async function createGateGuard(ctx: TenantContext, rawInput: unknown) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const input = gateGuardInputSchema.parse(rawInput);
  if (!input.password) {
    throw new ValidationError("Yeni nizamiye kullanıcısı için şifre girilmelidir.");
  }

  const existing = await gateGuardRepository.findGateGuardByEmail(input.email);
  if (existing) {
    throw new ValidationError(
      `${input.email} adresi zaten bir nizamiye kullanıcısı tarafından kullanılıyor.`
    );
  }
  await assertEmailNotUsedElsewhere(input.email);

  const passwordHash = await hash(input.password, 10);
  return gateGuardRepository.createGateGuardRecord(ctx, {
    fullName: input.fullName,
    email: input.email,
    passwordHash,
  });
}

export async function updateGateGuard(
  ctx: TenantContext,
  gateGuardId: string,
  rawInput: unknown
) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const input = gateGuardInputSchema.parse(rawInput);

  const existing = await gateGuardRepository.getGateGuardForTenant(
    ctx,
    gateGuardId
  );
  if (!existing) throw new NotFoundError("Nizamiye kullanıcısı bulunamadı.");

  if (input.email !== existing.email) {
    const emailOwner = await gateGuardRepository.findGateGuardByEmail(
      input.email
    );
    if (emailOwner) {
      throw new ValidationError(
        `${input.email} adresi zaten bir nizamiye kullanıcısı tarafından kullanılıyor.`
      );
    }
    await assertEmailNotUsedElsewhere(input.email);
  }

  // undefined means "leave passwordHash untouched" — blank password on edit
  // keeps the existing credential, same convention as Driver's edit form.
  const passwordHash = input.password
    ? await hash(input.password, 10)
    : undefined;

  await gateGuardRepository.updateGateGuardRecord(ctx, gateGuardId, {
    fullName: input.fullName,
    email: input.email,
    ...(passwordHash !== undefined ? { passwordHash } : {}),
  });
}

export async function deleteGateGuard(ctx: TenantContext, gateGuardId: string) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const existing = await gateGuardRepository.getGateGuardForTenant(
    ctx,
    gateGuardId
  );
  if (!existing) throw new NotFoundError("Nizamiye kullanıcısı bulunamadı.");

  await gateGuardRepository.deleteGateGuardRecord(ctx, gateGuardId);
}
