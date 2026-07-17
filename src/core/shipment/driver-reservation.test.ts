import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { listActiveShipmentsForDriver } from "@/core/shipment/shipment-service";
import * as dockReservationService from "@/core/warehouse/dock-reservation-service";
import {
  cleanupCompanies,
  createCustomerContext,
  createSupplierContext,
  createTestDock,
  createTestDriver,
  createTestWarehouse,
} from "@/test/fixtures";

function futureSlot(hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(hour, 0, 0, 0);
  return d;
}

describe("listActiveShipmentsForDriver: dock reservation visibility", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("surfaces the active dock reservation (warehouse name/address/link, dock, time) to the driver", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const driver = await createTestDriver(supplierCtx.companyId);
    const shipment = await prisma.shipment.create({
      data: {
        customerCompanyId: customerCtx.companyId,
        supplierCompanyId: supplierCtx.companyId,
        driverId: driver.id,
        originAddress: "A",
        destinationAddress: "B",
        distanceKm: 100,
        tonnage: 5,
        status: "ASSIGNED",
      },
    });

    const warehouse = await createTestWarehouse(customerCtx.companyId, {
      address: "Hadımköy, İstanbul",
      mapsUrl: "https://maps.google.com/?q=41.1,28.7",
    });
    const dock = await createTestDock(warehouse.id, { slotDurationMinutes: 60 });
    const startAt = futureSlot(9);
    await dockReservationService.createReservation(customerCtx, dock.id, {
      reservationType: "LOADING",
      reason: "Palet yükleme",
      plate: "34 TST 001",
      driverName: driver.fullName,
      startAt,
      shipmentId: shipment.id,
    });

    const shipments = await listActiveShipmentsForDriver({
      driverId: driver.id,
      companyId: supplierCtx.companyId,
      fullName: driver.fullName,
    });

    const found = shipments.find((s) => s.id === shipment.id);
    expect(found).toBeDefined();
    expect(found!.dockReservations).toHaveLength(1);
    const res = found!.dockReservations[0];
    expect(res.dock.name).toBe(dock.name);
    expect(res.dock.warehouse.name).toBe(warehouse.name);
    expect(res.dock.warehouse.address).toBe("Hadımköy, İstanbul");
    expect(res.dock.warehouse.mapsUrl).toBe("https://maps.google.com/?q=41.1,28.7");
    expect(res.startAt.getTime()).toBe(startAt.getTime());
  });

  it("excludes a cancelled reservation from the driver's view", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const driver = await createTestDriver(supplierCtx.companyId);
    const shipment = await prisma.shipment.create({
      data: {
        customerCompanyId: customerCtx.companyId,
        supplierCompanyId: supplierCtx.companyId,
        driverId: driver.id,
        originAddress: "A",
        destinationAddress: "B",
        distanceKm: 100,
        tonnage: 5,
        status: "ASSIGNED",
      },
    });

    const warehouse = await createTestWarehouse(customerCtx.companyId);
    const dock = await createTestDock(warehouse.id, { slotDurationMinutes: 60 });
    const reservation = await dockReservationService.createReservation(
      customerCtx,
      dock.id,
      {
        reservationType: "LOADING",
        reason: "Palet yükleme",
        plate: "34 TST 002",
        driverName: driver.fullName,
        startAt: futureSlot(10),
        shipmentId: shipment.id,
      }
    );
    await prisma.dockReservation.update({
      where: { id: reservation.id },
      data: { status: "CANCELLED" },
    });

    const shipments = await listActiveShipmentsForDriver({
      driverId: driver.id,
      companyId: supplierCtx.companyId,
      fullName: driver.fullName,
    });
    const found = shipments.find((s) => s.id === shipment.id);
    expect(found!.dockReservations).toHaveLength(0);
  });
});
