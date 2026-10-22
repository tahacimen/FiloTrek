import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError } from "@/core/shared/errors";
import * as consigneeRepository from "@/core/consignee/consignee-repository";
import { consigneeInputSchema } from "@/lib/validation/consignee";
import { CompanyType } from "@/generated/prisma/client";

/** Customer-only: the company's own cari / consignee list (active entries). */
export async function listConsignees(ctx: TenantContext) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  return consigneeRepository.listConsigneesForTenant(ctx);
}

export async function getConsignee(ctx: TenantContext, id: string) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const consignee = await consigneeRepository.getConsigneeForTenant(ctx, id);
  if (!consignee) throw new NotFoundError("Cari bulunamadı.");
  return consignee;
}

export async function createConsignee(ctx: TenantContext, rawInput: unknown) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const input = consigneeInputSchema.parse(rawInput);
  return consigneeRepository.createConsigneeRecord(ctx, input);
}

export async function updateConsignee(
  ctx: TenantContext,
  id: string,
  rawInput: unknown
) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const input = consigneeInputSchema.parse(rawInput);
  const existing = await consigneeRepository.getConsigneeForTenant(ctx, id);
  if (!existing) throw new NotFoundError("Cari bulunamadı.");
  await consigneeRepository.updateConsigneeRecord(ctx, id, input);
}

export async function removeConsignee(ctx: TenantContext, id: string) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const existing = await consigneeRepository.getConsigneeForTenant(ctx, id);
  if (!existing) throw new NotFoundError("Cari bulunamadı.");
  await consigneeRepository.deactivateConsigneeRecord(ctx, id);
}
