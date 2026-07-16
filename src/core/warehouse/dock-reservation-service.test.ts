import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import * as dockReservationService from "@/core/warehouse/dock-reservation-service";
import { cancelReservation } from "@/core/warehouse/dock-reservation-status";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import {
  cleanupCompanies,
  createCustomerContext,
  createTestCompany,
  createTestDock,
  createTestWarehouse,
} from "@/test/fixtures";
import { CompanyType } from "@/generated/prisma/client";

function slot(hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + 3); // safely in the future, avoids any today-boundary edge cases
  d.setHours(hour, 0, 0, 0);
  return d;
}

const baseReservationInput = {
  reservationType: "LOADING" as const,
  reason: "Palet yükleme",
  plate: "34 TST 001",
  driverName: "Test Sürücü",
};

/**
 * Shipment's own status doesn't matter for these tests — createReservation's
 * shipmentId check is ownership + already-linked only, not status. `customerCompanyId`
 * is the same company that owns the warehouse in these tests (the reservation-linking
 * ownership check is customerCompanyId-based, see getShipmentForCustomer);
 * supplier is a separate ad-hoc company, matching the real ownership split.
 */
async function createTestShipment(customerCompanyId: string) {
  const supplier = await createTestCompany(CompanyType.SUPPLIER);
  const shipment = await prisma.shipment.create({
    data: {
      customerCompanyId,
      supplierCompanyId: supplier.id,
      originAddress: "A",
      destinationAddress: "B",
      distanceKm: 100,
      tonnage: 5,
      status: "ASSIGNED",
    },
  });
  return { supplier, shipment };
}

describe("dock-reservation-service", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("creates a reservation and computes endAt from the dock's slot duration", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);
    const warehouse = await createTestWarehouse(ctx.companyId);
    const dock = await createTestDock(warehouse.id, { slotDurationMinutes: 30 });

    const startAt = slot(9);
    const reservation = await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      startAt,
    });
    expect(reservation.startAt.getTime()).toBe(startAt.getTime());
    expect(reservation.endAt.getTime()).toBe(startAt.getTime() + 30 * 60_000);
    expect(reservation.status).toBe("CREATED");
  });

  it("rejects a reservation type the dock doesn't support", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);
    const warehouse = await createTestWarehouse(ctx.companyId);
    const dock = await createTestDock(warehouse.id, {
      supportedReservationTypes: ["LOADING"],
    });

    await expect(
      dockReservationService.createReservation(ctx, dock.id, {
        ...baseReservationInput,
        reservationType: "UNLOADING",
        startAt: slot(10),
      })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects an overlapping reservation on the same dock (DB exclusion constraint)", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);
    const warehouse = await createTestWarehouse(ctx.companyId);
    const dock = await createTestDock(warehouse.id, { slotDurationMinutes: 60 });

    const startAt = slot(11);
    await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      startAt,
    });

    const overlapStart = new Date(startAt.getTime() + 15 * 60_000);
    await expect(
      dockReservationService.createReservation(ctx, dock.id, {
        ...baseReservationInput,
        plate: "34 TST 002",
        startAt: overlapStart,
      })
    ).rejects.toThrow(ValidationError);

    // Directly adjacent (non-overlapping) slot must still succeed.
    const adjacentStart = new Date(startAt.getTime() + 60 * 60_000);
    const adjacent = await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      plate: "34 TST 003",
      startAt: adjacentStart,
    });
    expect(adjacent.startAt.getTime()).toBe(adjacentStart.getTime());
  });

  it("allows re-booking the same slot once the original reservation is cancelled", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);
    const warehouse = await createTestWarehouse(ctx.companyId);
    const dock = await createTestDock(warehouse.id, { slotDurationMinutes: 60 });

    const startAt = slot(13);
    const first = await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      startAt,
    });
    await cancelReservation(ctx, first.id);

    const rebooked = await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      plate: "34 TST 004",
      startAt,
    });
    expect(rebooked.startAt.getTime()).toBe(startAt.getTime());
  });

  it("prevents creating a reservation on another tenant's dock", async () => {
    const ctxA = await createCustomerContext();
    const ctxB = await createCustomerContext();
    companyIds.push(ctxA.companyId, ctxB.companyId);
    const warehouseA = await createTestWarehouse(ctxA.companyId);
    const dockA = await createTestDock(warehouseA.id);

    await expect(
      dockReservationService.createReservation(ctxB, dockA.id, {
        ...baseReservationInput,
        startAt: slot(15),
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("links a reservation to one of the tenant's own shipments", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);
    const { supplier, shipment } = await createTestShipment(ctx.companyId);
    companyIds.push(supplier.id);
    const warehouse = await createTestWarehouse(ctx.companyId);
    const dock = await createTestDock(warehouse.id);

    const reservation = await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      startAt: slot(16),
      shipmentId: shipment.id,
    });
    expect(reservation.shipmentId).toBe(shipment.id);
  });

  it("rejects linking a reservation to another tenant's shipment", async () => {
    const ctxA = await createCustomerContext();
    const ctxB = await createCustomerContext();
    companyIds.push(ctxA.companyId, ctxB.companyId);
    const { supplier, shipment } = await createTestShipment(ctxA.companyId);
    companyIds.push(supplier.id);
    const warehouseB = await createTestWarehouse(ctxB.companyId);
    const dockB = await createTestDock(warehouseB.id);

    await expect(
      dockReservationService.createReservation(ctxB, dockB.id, {
        ...baseReservationInput,
        startAt: slot(17),
        shipmentId: shipment.id,
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects linking to a shipment that's already linked to another active reservation", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);
    const { supplier, shipment } = await createTestShipment(ctx.companyId);
    companyIds.push(supplier.id);
    const warehouse = await createTestWarehouse(ctx.companyId);
    const dock = await createTestDock(warehouse.id);

    await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      startAt: slot(18),
      shipmentId: shipment.id,
    });

    await expect(
      dockReservationService.createReservation(ctx, dock.id, {
        ...baseReservationInput,
        plate: "34 TST 005",
        startAt: slot(19),
        shipmentId: shipment.id,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("allows re-linking a shipment once its previous reservation is cancelled", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);
    const { supplier, shipment } = await createTestShipment(ctx.companyId);
    companyIds.push(supplier.id);
    const warehouse = await createTestWarehouse(ctx.companyId);
    const dock = await createTestDock(warehouse.id);

    const first = await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      startAt: slot(20),
      shipmentId: shipment.id,
    });
    await cancelReservation(ctx, first.id);

    const second = await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      plate: "34 TST 006",
      startAt: slot(21),
      shipmentId: shipment.id,
    });
    expect(second.shipmentId).toBe(shipment.id);
  });
});
