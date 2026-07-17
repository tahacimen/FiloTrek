import { rm } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/db";
import {
  CompanyRole,
  CompanyType,
  DockReservationType,
  DriverStatus,
  VehicleBedType,
  VehicleStatus,
  VehicleType,
} from "@/generated/prisma/client";
import type { TenantContext } from "@/core/shared/tenant-context";
import type { DriverContext } from "@/core/shared/driver-context";
import type { GateGuardContext } from "@/core/shared/gate-guard-context";

// Test files each get their own module instance in Vitest, so a per-file
// counter alone can collide across files that happen to run in the same
// millisecond (seen in practice once enough test files run in parallel).
// A random hex slice is both collision-resistant and short enough to stay
// under the tighter Zod length limits (e.g. licenseNumber's max of 30) that
// some tests feed generated fixture values back through.
function unique(prefix: string) {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `${prefix}-${random}`;
}

export async function createTestCompany(type: CompanyType) {
  return prisma.company.create({
    data: { name: unique("company"), type },
  });
}

export async function createTestUser(
  companyId: string,
  overrides: Partial<{ isPlatformAdmin: boolean }> = {}
) {
  return prisma.user.create({
    data: {
      companyId,
      email: `${unique("user")}@test.local`,
      passwordHash: "unused-in-tests",
      fullName: "Test User",
      companyRole: CompanyRole.ADMIN,
      isPlatformAdmin: overrides.isPlatformAdmin ?? false,
    },
  });
}

export async function createSupplierContext(): Promise<TenantContext> {
  const company = await createTestCompany(CompanyType.SUPPLIER);
  const user = await createTestUser(company.id);
  return {
    userId: user.id,
    companyId: company.id,
    companyType: CompanyType.SUPPLIER,
    companyRole: CompanyRole.ADMIN,
    isPlatformAdmin: false,
  };
}

export async function createCustomerContext(): Promise<TenantContext> {
  const company = await createTestCompany(CompanyType.CUSTOMER);
  const user = await createTestUser(company.id);
  return {
    userId: user.id,
    companyId: company.id,
    companyType: CompanyType.CUSTOMER,
    companyRole: CompanyRole.ADMIN,
    isPlatformAdmin: false,
  };
}

/** A CUSTOMER-company user who is ALSO a platform admin — the two are independent (see schema.prisma comment above Invitation). */
export async function createPlatformAdminContext(): Promise<TenantContext> {
  const company = await createTestCompany(CompanyType.CUSTOMER);
  const user = await createTestUser(company.id, { isPlatformAdmin: true });
  return {
    userId: user.id,
    companyId: company.id,
    companyType: CompanyType.CUSTOMER,
    companyRole: CompanyRole.ADMIN,
    isPlatformAdmin: true,
  };
}

export async function createTestVehicle(
  companyId: string,
  overrides: Partial<{ status: VehicleStatus; plate: string; vehicleType: VehicleType }> = {}
) {
  return prisma.vehicle.create({
    data: {
      companyId,
      plate: overrides.plate ?? unique("PLT").toUpperCase(),
      vehicleType: overrides.vehicleType ?? VehicleType.KAMYON,
      bedType: VehicleBedType.KAPALI_KASA,
      tonnageCapacity: 10,
      status: overrides.status ?? VehicleStatus.AVAILABLE,
    },
  });
}

export async function createTestDriver(
  companyId: string,
  overrides: Partial<{ status: DriverStatus; email: string }> = {}
) {
  return prisma.driver.create({
    data: {
      companyId,
      fullName: "Test Driver",
      phone: "0500 000 00 00",
      licenseNumber: unique("LIC").toUpperCase(),
      email: overrides.email,
      status: overrides.status ?? DriverStatus.AVAILABLE,
    },
  });
}

/** Built by hand from a freshly-inserted row, never via auth() — same rationale as createSupplierContext. */
export async function createDriverContext(
  companyId: string
): Promise<DriverContext> {
  const driver = await createTestDriver(companyId);
  return { driverId: driver.id, companyId, fullName: driver.fullName };
}

export async function createTestWarehouse(
  companyId: string,
  overrides: Partial<{ address: string; mapsUrl: string; isDefault: boolean }> = {}
) {
  return prisma.warehouse.create({
    data: { companyId, name: unique("warehouse"), ...overrides },
  });
}

/** Working hours are wide open (00:00-23:00, every day) so tests can pick any near-future time without fighting real business-hour alignment — the exclusion constraint and status transitions are what's under test, not the calendar grid. */
export async function createTestDock(
  warehouseId: string,
  overrides: Partial<{
    supportedReservationTypes: DockReservationType[];
    supportedVehicleTypes: VehicleType[];
    supportedBedTypes: VehicleBedType[];
    slotDurationMinutes: number;
  }> = {}
) {
  return prisma.loadingDock.create({
    data: {
      warehouseId,
      name: unique("dock"),
      supportedReservationTypes: overrides.supportedReservationTypes ?? [
        DockReservationType.LOADING,
        DockReservationType.UNLOADING,
      ],
      supportedVehicleTypes: overrides.supportedVehicleTypes ?? [
        VehicleType.TIR,
        VehicleType.KAMYON,
      ],
      supportedBedTypes: overrides.supportedBedTypes ?? [VehicleBedType.KAPALI_KASA],
      slotDurationMinutes: overrides.slotDurationMinutes ?? 60,
      workingHours: {
        createMany: {
          data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
            dayOfWeek,
            isOpen: true,
            openTime: "00:00",
            closeTime: "23:00",
          })),
        },
      },
    },
    include: { workingHours: true },
  });
}

export async function createTestGateGuard(companyId: string) {
  return prisma.gateGuard.create({
    data: {
      companyId,
      fullName: "Test Gate Guard",
      email: `${unique("gate-guard")}@test.local`,
      passwordHash: "unused-in-tests",
    },
  });
}

/** Built by hand from a freshly-inserted row, never via auth() — same rationale as createDriverContext. */
export async function createGateGuardContext(
  companyId: string
): Promise<GateGuardContext> {
  const gateGuard = await createTestGateGuard(companyId);
  return { gateGuardId: gateGuard.id, companyId, fullName: gateGuard.fullName };
}

/**
 * Content-type is what file-storage.ts validates, not real JPEG bytes — the
 * fake content is never actually decoded as an image anywhere in this app.
 */
export function createTestPhotoFile(name = "photo.jpg"): File {
  return new File(["fake-jpeg-bytes"], name, { type: "image/jpeg" });
}

/** Deletes everything created for the given company ids (and their dependents). */
export async function cleanupCompanies(companyIds: string[]) {
  const shipmentIds = await shipmentIdsFor(companyIds);

  await prisma.statusHistory.deleteMany({
    where: {
      OR: [
        { entityId: { in: await vehicleIdsFor(companyIds) } },
        { entityId: { in: await driverIdsFor(companyIds) } },
        { entityId: { in: shipmentIds } },
      ],
    },
  });
  // ShipmentIncident and GateEvent rows cascade automatically (real FKs,
  // unlike StatusHistory's polymorphic entityId above) when the shipment
  // itself is deleted below — no explicit deleteMany needed for them. This
  // also means gate_guards can be deleted next with no GateEvent rows left
  // to trip GateEvent.gateGuardId's ON DELETE RESTRICT. Files on disk don't
  // cascade with anything, though.
  await prisma.shipment.deleteMany({
    where: {
      OR: [
        { customerCompanyId: { in: companyIds } },
        { supplierCompanyId: { in: companyIds } },
      ],
    },
  });
  await prisma.vehicle.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.driver.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.gateGuard.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });

  await Promise.all(
    shipmentIds.map((id) =>
      rm(path.join(process.cwd(), "uploads", id), {
        recursive: true,
        force: true,
      })
    )
  );
}

async function vehicleIdsFor(companyIds: string[]) {
  const rows = await prisma.vehicle.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function driverIdsFor(companyIds: string[]) {
  const rows = await prisma.driver.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function shipmentIdsFor(companyIds: string[]) {
  const rows = await prisma.shipment.findMany({
    where: {
      OR: [
        { customerCompanyId: { in: companyIds } },
        { supplierCompanyId: { in: companyIds } },
      ],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
