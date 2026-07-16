import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import * as dockReservationService from "@/core/warehouse/dock-reservation-service";
import {
  cancelReservation,
  markCompleted,
  markVehicleArrived,
} from "@/core/warehouse/dock-reservation-status";
import {
  advanceShipmentStatus,
  assignVehicleAndDriver,
} from "@/core/shipment/shipment-status";
import { InvalidTransitionError, NotFoundError } from "@/core/shared/errors";
import {
  cleanupCompanies,
  createSupplierContext,
  createTestCompany,
  createTestDock,
  createTestDriver,
  createTestVehicle,
  createTestWarehouse,
} from "@/test/fixtures";
import { CompanyType, ShipmentStatus } from "@/generated/prisma/client";
import type { TenantContext } from "@/core/shared/tenant-context";

function slot(hour: number, dayOffset = 3) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const baseReservationInput = {
  reservationType: "LOADING" as const,
  reason: "Palet yükleme",
  plate: "34 TST 010",
  driverName: "Test Sürücü",
};

async function makeReservation(ctx: Awaited<ReturnType<typeof createSupplierContext>>) {
  const warehouse = await createTestWarehouse(ctx.companyId);
  const dock = await createTestDock(warehouse.id);
  return dockReservationService.createReservation(ctx, dock.id, {
    ...baseReservationInput,
    startAt: slot(9, Math.floor(Math.random() * 100) + 3),
  });
}

const AGREED_PRICE = 15000;

function approvePriceDirectly(shipmentId: string) {
  return prisma.shipment.update({
    where: { id: shipmentId },
    data: { priceApprovedAt: new Date() },
  });
}

/** A shipment with a vehicle/driver but not yet dispatched — used to prove the sync silently no-ops when the shipment isn't at the matching step. */
async function setupAssignedShipment(ctx: TenantContext) {
  const customer = await createTestCompany(CompanyType.CUSTOMER);
  const vehicle = await createTestVehicle(ctx.companyId);
  const driver = await createTestDriver(ctx.companyId);
  const shipment = await prisma.shipment.create({
    data: {
      customerCompanyId: customer.id,
      supplierCompanyId: ctx.companyId,
      originAddress: "A",
      destinationAddress: "B",
      distanceKm: 100,
      tonnage: 5,
      status: ShipmentStatus.PENDING,
    },
  });
  await assignVehicleAndDriver(ctx, {
    shipmentId: shipment.id,
    vehicleId: vehicle.id,
    driverId: driver.id,
    agreedPrice: AGREED_PRICE,
  });
  return { customer, shipmentId: shipment.id };
}

/** A shipment already HEADING_TO_PICKUP — the natural state for the dock-reservation sync's first hop (-> LOADING) to succeed. */
async function setupHeadingToPickupShipment(ctx: TenantContext) {
  const { customer, shipmentId } = await setupAssignedShipment(ctx);
  await approvePriceDirectly(shipmentId);
  await advanceShipmentStatus(ctx, {
    shipmentId,
    targetStatus: ShipmentStatus.HEADING_TO_PICKUP,
  });
  return { customer, shipmentId };
}

describe("dock-reservation-status", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("advances CREATED -> VEHICLE_ARRIVED -> COMPLETED, stamping real timestamps", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const reservation = await makeReservation(ctx);

    const arrived = await markVehicleArrived(ctx, reservation.id);
    expect(arrived.status).toBe("VEHICLE_ARRIVED");
    expect(arrived.arrivedAt).not.toBeNull();

    const completed = await markCompleted(ctx, reservation.id);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).not.toBeNull();
  });

  it("allows completing directly from CREATED, skipping VEHICLE_ARRIVED", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const reservation = await makeReservation(ctx);

    const completed = await markCompleted(ctx, reservation.id);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.arrivedAt).toBeNull();
    expect(completed.completedAt).not.toBeNull();
  });

  it("rejects transitions out of a terminal status", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const reservation = await makeReservation(ctx);

    await cancelReservation(ctx, reservation.id);

    await expect(markVehicleArrived(ctx, reservation.id)).rejects.toThrow(
      InvalidTransitionError
    );
    await expect(markCompleted(ctx, reservation.id)).rejects.toThrow(
      InvalidTransitionError
    );
    await expect(cancelReservation(ctx, reservation.id)).rejects.toThrow(
      InvalidTransitionError
    );
  });

  it("sets cancelledAt when a reservation is cancelled", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const reservation = await makeReservation(ctx);

    const cancelled = await cancelReservation(ctx, reservation.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();
  });

  it("prevents transitioning a reservation belonging to another tenant", async () => {
    const ctxA = await createSupplierContext();
    const ctxB = await createSupplierContext();
    companyIds.push(ctxA.companyId, ctxB.companyId);
    const reservation = await makeReservation(ctxA);

    await expect(markVehicleArrived(ctxB, reservation.id)).rejects.toThrow(
      NotFoundError
    );
  });

  it("advances a linked shipment to LOADING when its dock reservation's vehicle arrives", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const { customer, shipmentId } = await setupHeadingToPickupShipment(ctx);
    companyIds.push(customer.id);
    const warehouse = await createTestWarehouse(ctx.companyId);
    const dock = await createTestDock(warehouse.id);
    const reservation = await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      startAt: slot(9, 50),
      shipmentId,
    });

    await markVehicleArrived(ctx, reservation.id);

    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
    });
    expect(shipment.status).toBe(ShipmentStatus.LOADING);
  });

  it("chains a linked shipment through LOADING to AT_PICKUP_GATE when the reservation completes directly from CREATED", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const { customer, shipmentId } = await setupHeadingToPickupShipment(ctx);
    companyIds.push(customer.id);
    const warehouse = await createTestWarehouse(ctx.companyId);
    const dock = await createTestDock(warehouse.id);
    const reservation = await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      startAt: slot(10, 51),
      shipmentId,
    });

    await markCompleted(ctx, reservation.id);

    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
    });
    expect(shipment.status).toBe(ShipmentStatus.AT_PICKUP_GATE);
  });

  it("leaves the linked shipment's status untouched when it isn't ready for the matching transition yet", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    // Still ASSIGNED, not yet HEADING_TO_PICKUP — LOADING isn't a valid
    // transition from here, so the sync must silently no-op rather than
    // corrupting the shipment's own state machine, while the reservation's
    // own status change still succeeds.
    const { customer, shipmentId } = await setupAssignedShipment(ctx);
    companyIds.push(customer.id);
    const warehouse = await createTestWarehouse(ctx.companyId);
    const dock = await createTestDock(warehouse.id);
    const reservation = await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      startAt: slot(11, 52),
      shipmentId,
    });

    const arrived = await markVehicleArrived(ctx, reservation.id);
    expect(arrived.status).toBe("VEHICLE_ARRIVED");

    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
    });
    expect(shipment.status).toBe(ShipmentStatus.ASSIGNED);
  });

  it("does not touch the linked shipment's status when the reservation is cancelled", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const { customer, shipmentId } = await setupHeadingToPickupShipment(ctx);
    companyIds.push(customer.id);
    const warehouse = await createTestWarehouse(ctx.companyId);
    const dock = await createTestDock(warehouse.id);
    const reservation = await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      startAt: slot(12, 53),
      shipmentId,
    });

    await cancelReservation(ctx, reservation.id);

    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
    });
    expect(shipment.status).toBe(ShipmentStatus.HEADING_TO_PICKUP);
  });
});
