import { requirePlatformAdmin } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError } from "@/core/shared/errors";
import * as demoRepository from "@/core/demo/demo-repository";
import { demoRequestInputSchema } from "@/lib/validation/demo";
import { DemoRequestStatus } from "@/generated/prisma/client";

/**
 * Public — anyone can request a demo; this creates NO account (registration is
 * closed, accounts are owner-created). Just validates and records the lead for
 * the owner to follow up on from /admin.
 */
export async function createDemoRequest(rawInput: unknown) {
  const input = demoRequestInputSchema.parse(rawInput);
  return demoRepository.createDemoRequest({
    fullName: input.fullName,
    companyName: input.companyName,
    phone: input.phone,
    email: input.email,
    vehicleCount: input.vehicleCount,
    message: input.message ? input.message : null,
  });
}

/** Platform-admin only — the owner's demo-lead inbox in /admin. */
export async function listDemoRequests(ctx: TenantContext) {
  requirePlatformAdmin(ctx);
  return demoRepository.listDemoRequests();
}

/** Platform-admin only — mark a lead as contacted (or back to new). */
export async function setDemoRequestStatus(
  ctx: TenantContext,
  id: string,
  status: DemoRequestStatus
) {
  requirePlatformAdmin(ctx);
  const existing = await demoRepository.findDemoRequestById(id);
  if (!existing) throw new NotFoundError("Demo talebi bulunamadı.");
  return demoRepository.updateDemoRequestStatus(id, status);
}
