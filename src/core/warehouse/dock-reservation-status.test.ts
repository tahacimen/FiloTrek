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
  createCustomerContext,
  createGateGuardContext,
  createSupplierContext,
  createTestDock,
  createTestDriver,
  createTestVehicle,
  createTestWarehouse,
} from "@/test/fixtures";
import { ShipmentStatus } from "@/generated/prisma/client";
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

/** customerCtx owns the warehouse/dock (see the schema comment above Warehouse). */
async function makeReservation(customerCtx: TenantContext) {
  const warehouse = await createTestWarehouse(customerCtx.companyId);
  const dock = await createTestDock(warehouse.id);
  return dockReservationService.createReservation(customerCtx, dock.id, {
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

/**
 * A shipment with a vehicle/driver but not yet dispatched — used to prove
 * the sync silently no-ops when the shipment isn't at the matching step.
 * The warehouse-owning customer is the shipment's own customerCompanyId; a
 * separate ad-hoc supplier company executes it (vehicle/driver/assignment),
 * matching the real ownership split this whole module was redesigned around.
 */
async function setupAssignedShipment(customerCtx: TenantContext) {
  const supplierCtx = await createSupplierContext();
  const vehicle = await createTestVehicle(supplierCtx.companyId);
  const driver = await createTestDriver(supplierCtx.companyId);
  const shipment = await prisma.shipment.create({
    data: {
      customerCompanyId: customerCtx.companyId,
      supplierCompanyId: supplierCtx.companyId,
      originAddress: "A",
      destinationAddress: "B",
      distanceKm: 100,
      tonnage: 5,
      status: ShipmentStatus.PENDING,
    },
  });
  await assignVehicleAndDriver(supplierCtx, {
    shipmentId: shipment.id,
    vehicleId: vehicle.id,
    driverId: driver.id,
    agreedPrice: AGREED_PRICE,
  });
  return { supplierCtx, shipmentId: shipment.id };
}

/** A shipment already HEADING_TO_PICKUP — the natural state for the dock-reservation sync's first hop (-> LOADING) to succeed. */
async function setupHeadingToPickupShipment(customerCtx: TenantContext) {
  const { supplierCtx, shipmentId } = await setupAssignedShipment(customerCtx);
  await approvePriceDirectly(shipmentId);
  await advanceShipmentStatus(supplierCtx, {
    shipmentId,
    targetStatus: ShipmentStatus.HEADING_TO_PICKUP,
  });
  return { supplierCtx, shipmentId };
}

describe("dock-reservation-status", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("advances CREATED -> VEHICLE_ARRIVED -> COMPLETED, stamping real timestamps", async () => {
    const customerCtx = await createCustomerContext();
    companyIds.push(customerCtx.companyId);
    const gateGuardCtx = await createGateGuardContext(customerCtx.companyId);
    const reservation = await makeReservation(customerCtx);

    const arrived = await markVehicleArrived(gateGuardCtx, reservation.id);
    expect(arrived.status).toBe("VEHICLE_ARRIVED");
    expect(arrived.arrivedAt).not.toBeNull();

    const completed = await markCompleted(gateGuardCtx, reservation.id);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).not.toBeNull();
  });

  it("allows completing directly from CREATED, skipping VEHICLE_ARRIVED", async () => {
    const customerCtx = await createCustomerContext();
    companyIds.push(customerCtx.companyId);
    const gateGuardCtx = await createGateGuardContext(customerCtx.companyId);
    const reservation = await makeReservation(customerCtx);

    const completed = await markCompleted(gateGuardCtx, reservation.id);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.arrivedAt).toBeNull();
    expect(completed.completedAt).not.toBeNull();
  });

  it("rejects transitions out of a terminal status", async () => {
    const customerCtx = await createCustomerContext();
    companyIds.push(customerCtx.companyId);
    const gateGuardCtx = await createGateGuardContext(customerCtx.companyId);
    const reservation = await makeReservation(customerCtx);

    await cancelReservation(customerCtx, reservation.id);

    await expect(markVehicleArrived(gateGuardCtx, reservation.id)).rejects.toThrow(
      InvalidTransitionError
    );
    await expect(markCompleted(gateGuardCtx, reservation.id)).rejects.toThrow(
      InvalidTransitionError
    );
    await expect(cancelReservation(customerCtx, reservation.id)).rejects.toThrow(
      InvalidTransitionError
    );
  });

  it("sets cancelledAt when a reservation is cancelled", async () => {
    const customerCtx = await createCustomerContext();
    companyIds.push(customerCtx.companyId);
    const reservation = await makeReservation(customerCtx);

    const cancelled = await cancelReservation(customerCtx, reservation.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();
  });

  it("prevents a gate guard from transitioning a reservation belonging to another customer", async () => {
    const customerCtxA = await createCustomerContext();
    const customerCtxB = await createCustomerContext();
    companyIds.push(customerCtxA.companyId, customerCtxB.companyId);
    const reservation = await makeReservation(customerCtxA);
    const gateGuardCtxB = await createGateGuardContext(customerCtxB.companyId);

    await expect(markVehicleArrived(gateGuardCtxB, reservation.id)).rejects.toThrow(
      NotFoundError
    );
  });

  it("prevents a customer from cancelling another customer's reservation", async () => {
    const customerCtxA = await createCustomerContext();
    const customerCtxB = await createCustomerContext();
    companyIds.push(customerCtxA.companyId, customerCtxB.companyId);
    const reservation = await makeReservation(customerCtxA);

    await expect(cancelReservation(customerCtxB, reservation.id)).rejects.toThrow(
      NotFoundError
    );
  });

  it("advances a linked shipment to LOADING when its dock reservation's vehicle arrives", async () => {
    const customerCtx = await createCustomerContext();
    companyIds.push(customerCtx.companyId);
    const gateGuardCtx = await createGateGuardContext(customerCtx.companyId);
    const { supplierCtx, shipmentId } = await setupHeadingToPickupShipment(customerCtx);
    companyIds.push(supplierCtx.companyId);
    const warehouse = await createTestWarehouse(customerCtx.companyId);
    const dock = await createTestDock(warehouse.id);
    const reservation = await dockReservationService.createReservation(customerCtx, dock.id, {
      ...baseReservationInput,
      startAt: slot(9, 50),
      shipmentId,
    });

    await markVehicleArrived(gateGuardCtx, reservation.id);

    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
    });
    expect(shipment.status).toBe(ShipmentStatus.LOADING);
  });

  it("chains a linked shipment through LOADING to AT_PICKUP_GATE when the reservation completes directly from CREATED", async () => {
    const customerCtx = await createCustomerContext();
    companyIds.push(customerCtx.companyId);
    const gateGuardCtx = await createGateGuardContext(customerCtx.companyId);
    const { supplierCtx, shipmentId } = await setupHeadingToPickupShipment(customerCtx);
    companyIds.push(supplierCtx.companyId);
    const warehouse = await createTestWarehouse(customerCtx.companyId);
    const dock = await createTestDock(warehouse.id);
    const reservation = await dockReservationService.createReservation(customerCtx, dock.id, {
      ...baseReservationInput,
      startAt: slot(10, 51),
      shipmentId,
    });

    await markCompleted(gateGuardCtx, reservation.id);

    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
    });
    expect(shipment.status).toBe(ShipmentStatus.AT_PICKUP_GATE);
  });

  it("leaves the linked shipment's status untouched when it isn't ready for the matching transition yet", async () => {
    const customerCtx = await createCustomerContext();
    companyIds.push(customerCtx.companyId);
    const gateGuardCtx = await createGateGuardContext(customerCtx.companyId);
    // Still ASSIGNED, not yet HEADING_TO_PICKUP — LOADING isn't a valid
    // transition from here, so the sync must silently no-op rather than
    // corrupting the shipment's own state machine, while the reservation's
    // own status change still succeeds.
    const { supplierCtx, shipmentId } = await setupAssignedShipment(customerCtx);
    companyIds.push(supplierCtx.companyId);
    const warehouse = await createTestWarehouse(customerCtx.companyId);
    const dock = await createTestDock(warehouse.id);
    const reservation = await dockReservationService.createReservation(customerCtx, dock.id, {
      ...baseReservationInput,
      startAt: slot(11, 52),
      shipmentId,
    });

    const arrived = await markVehicleArrived(gateGuardCtx, reservation.id);
    expect(arrived.status).toBe("VEHICLE_ARRIVED");

    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
    });
    expect(shipment.status).toBe(ShipmentStatus.ASSIGNED);
  });

  it("does not touch the linked shipment's status when the reservation is cancelled", async () => {
    const customerCtx = await createCustomerContext();
    companyIds.push(customerCtx.companyId);
    const { supplierCtx, shipmentId } = await setupHeadingToPickupShipment(customerCtx);
    companyIds.push(supplierCtx.companyId);
    const warehouse = await createTestWarehouse(customerCtx.companyId);
    const dock = await createTestDock(warehouse.id);
    const reservation = await dockReservationService.createReservation(customerCtx, dock.id, {
      ...baseReservationInput,
      startAt: slot(12, 53),
      shipmentId,
    });

    await cancelReservation(customerCtx, reservation.id);

    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
    });
    expect(shipment.status).toBe(ShipmentStatus.HEADING_TO_PICKUP);
  });
});
