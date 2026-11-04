import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import * as dockReservationService from "@/core/warehouse/dock-reservation-service";
import {
  cleanupCompanies,
  createCustomerContext,
  createDriverContext,
  createSupplierContext,
  createTestDock,
  createTestVehicle,
  createTestWarehouse,
} from "@/test/fixtures";

function futureSlotStart(hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function setupAssignedShipment() {
  const customerCtx = await createCustomerContext();
  const supplierCtx = await createSupplierContext();
  const driverCtx = await createDriverContext(supplierCtx.companyId);
  const vehicle = await createTestVehicle(supplierCtx.companyId);
  const shipment = await prisma.shipment.create({
    data: {
      customerCompanyId: customerCtx.companyId,
      supplierCompanyId: supplierCtx.companyId,
      driverId: driverCtx.driverId,
      vehicleId: vehicle.id,
      originAddress: "A",
      destinationAddress: "B",
      distanceKm: 100,
      tonnage: 5,
      status: "ASSIGNED",
    },
  });
  const warehouse = await createTestWarehouse(customerCtx.companyId);
  const dock = await createTestDock(warehouse.id, { slotDurationMinutes: 60 });
  return { customerCtx, supplierCtx, driverCtx, shipment, warehouse, dock };
}

describe("D5: driver self-pick dock reservation", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("driver sees no dock options until the customer opens the calendar", async () => {
    const { customerCtx, supplierCtx, driverCtx, shipment, dock } =
      await setupAssignedShipment();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    // Flag off → no options.
    expect(
      await dockReservationService.listDockOptionsForDriver(
        driverCtx,
        shipment.id
      )
    ).toHaveLength(0);

    await dockReservationService.enableDriverDockSelection(
      customerCtx,
      shipment.id
    );

    const options = await dockReservationService.listDockOptionsForDriver(
      driverCtx,
      shipment.id
    );
    expect(options.map((o) => o.id)).toContain(dock.id);
  });

  it("drives the full request -> approve lifecycle and clears the flag", async () => {
    const { customerCtx, supplierCtx, driverCtx, shipment, dock } =
      await setupAssignedShipment();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    await dockReservationService.enableDriverDockSelection(
      customerCtx,
      shipment.id
    );

    const reservation = await dockReservationService.requestDockReservationAsDriver(
      driverCtx,
      shipment.id,
      dock.id,
      futureSlotStart(9)
    );
    expect(reservation.status).toBe("REQUESTED");
    expect(reservation.shipmentId).toBe(shipment.id);

    // A second request while one is pending is rejected.
    await expect(
      dockReservationService.requestDockReservationAsDriver(
        driverCtx,
        shipment.id,
        dock.id,
        futureSlotStart(11)
      )
    ).rejects.toThrow();

    await dockReservationService.approveDriverReservation(
      customerCtx,
      reservation.id
    );

    const approved = await prisma.dockReservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(approved.status).toBe("CREATED");

    const after = await prisma.shipment.findUniqueOrThrow({
      where: { id: shipment.id },
    });
    expect(after.driverDockSelectionEnabled).toBe(false);
  });

  it("rejecting frees the slot and keeps the calendar open for another pick", async () => {
    const { customerCtx, supplierCtx, driverCtx, shipment, dock } =
      await setupAssignedShipment();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    await dockReservationService.enableDriverDockSelection(
      customerCtx,
      shipment.id
    );

    const first = await dockReservationService.requestDockReservationAsDriver(
      driverCtx,
      shipment.id,
      dock.id,
      futureSlotStart(9)
    );
    await dockReservationService.rejectDriverReservation(
      customerCtx,
      first.id
    );

    const rejected = await prisma.dockReservation.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(rejected.status).toBe("CANCELLED");

    // Flag still on → driver can pick again (even the same slot, now freed).
    const stillEnabled = await prisma.shipment.findUniqueOrThrow({
      where: { id: shipment.id },
    });
    expect(stillEnabled.driverDockSelectionEnabled).toBe(true);

    const second = await dockReservationService.requestDockReservationAsDriver(
      driverCtx,
      shipment.id,
      dock.id,
      futureSlotStart(9)
    );
    expect(second.status).toBe("REQUESTED");
  });

  it("rejects a slot outside the dock's working hours", async () => {
    const { customerCtx, supplierCtx, driverCtx, shipment, dock } =
      await setupAssignedShipment();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    await dockReservationService.enableDriverDockSelection(
      customerCtx,
      shipment.id
    );

    // Dock closes at 23:00 (fixture); 23:30 is not an open slot start.
    const closed = futureSlotStart(23);
    closed.setMinutes(30);
    await expect(
      dockReservationService.requestDockReservationAsDriver(
        driverCtx,
        shipment.id,
        dock.id,
        closed
      )
    ).rejects.toThrow();
  });
});
