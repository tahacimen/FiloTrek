import { prisma } from "@/lib/db";
import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { ValidationError } from "@/core/shared/errors";
import { driverBlockInputSchema } from "@/lib/validation/driver-block";
import { CompanyType, Prisma } from "@/generated/prisma/client";

/** Customer-only: the company's own block ("kara liste") entries. */
export async function listDriverBlocks(ctx: TenantContext) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  return prisma.customerDriverBlock.findMany({
    where: { customerCompanyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
  });
}

/** Customer-only: block a person by TC and/or driver license number. */
export async function addDriverBlock(ctx: TenantContext, rawInput: unknown) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const input = driverBlockInputSchema.parse(rawInput);
  return prisma.customerDriverBlock.create({
    data: {
      customerCompanyId: ctx.companyId,
      fullName: input.fullName,
      tcNumber: input.tcNumber,
      licenseNumber: input.licenseNumber,
      reason: input.reason,
    },
  });
}

/** Customer-only: remove one of the company's own block entries. */
export async function removeDriverBlock(ctx: TenantContext, id: string) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  await prisma.customerDriverBlock.deleteMany({
    where: { id, customerCompanyId: ctx.companyId },
  });
  return { id };
}

/**
 * Returns a matching block if the given driver's identity (TC or license) is
 * on the customer's block list, else null. Accepts a transaction client so it
 * can run inside the assignment transaction. Matching is on non-null
 * identifiers only — a block with just a TC never matches a driver with a
 * different/absent TC.
 */
export async function findBlockForDriver(
  client: Prisma.TransactionClient | typeof prisma,
  customerCompanyId: string,
  driver: { tcNumber: string | null; licenseNumber: string | null }
) {
  const or: Prisma.CustomerDriverBlockWhereInput[] = [];
  if (driver.tcNumber) or.push({ tcNumber: driver.tcNumber });
  if (driver.licenseNumber) or.push({ licenseNumber: driver.licenseNumber });
  if (or.length === 0) return null;
  return client.customerDriverBlock.findFirst({
    where: { customerCompanyId, OR: or },
  });
}

/**
 * N7 (assignment screen): given a customer and a set of drivers, returns the
 * ids of those the customer has blocked — so the dispatcher's assign dialog
 * can grey them out and badge them rather than only finding out on submit.
 * Reads only the block list's identifiers (TC/license), never exposing the
 * customer's block reasons to the supplier. One query regardless of driver
 * count; matching is done in memory on non-null identifiers.
 */
export async function listBlockedDriverIdsForCustomer(
  client: Prisma.TransactionClient | typeof prisma,
  customerCompanyId: string,
  drivers: { id: string; tcNumber: string | null; licenseNumber: string | null }[]
): Promise<string[]> {
  if (drivers.length === 0) return [];
  const blocks = await client.customerDriverBlock.findMany({
    where: { customerCompanyId },
    select: { tcNumber: true, licenseNumber: true },
  });
  if (blocks.length === 0) return [];
  const blockedTc = new Set(
    blocks.map((b) => b.tcNumber).filter((v): v is string => v !== null)
  );
  const blockedLicense = new Set(
    blocks.map((b) => b.licenseNumber).filter((v): v is string => v !== null)
  );
  return drivers
    .filter(
      (d) =>
        (d.tcNumber !== null && blockedTc.has(d.tcNumber)) ||
        (d.licenseNumber !== null && blockedLicense.has(d.licenseNumber))
    )
    .map((d) => d.id);
}

/** Throws if the driver is blocked by the shipment's customer. */
export async function assertDriverNotBlockedForCustomer(
  client: Prisma.TransactionClient | typeof prisma,
  customerCompanyId: string,
  driver: { tcNumber: string | null; licenseNumber: string | null }
) {
  const block = await findBlockForDriver(client, customerCompanyId, driver);
  if (block) {
    throw new ValidationError(
      "Bu şoför, seferin müşterisi tarafından engellenmiş. Lütfen başka bir şoför atayın."
    );
  }
}
