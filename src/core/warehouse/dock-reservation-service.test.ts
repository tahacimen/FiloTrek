import { afterAll, describe, expect, it } from "vitest";

import * as dockReservationService from "@/core/warehouse/dock-reservation-service";
import { cancelReservation } from "@/core/warehouse/dock-reservation-status";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import {
  cleanupCompanies,
  createSupplierContext,
  createTestDock,
  createTestWarehouse,
} from "@/test/fixtures";

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

describe("dock-reservation-service", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("creates a reservation and computes endAt from the dock's slot duration", async () => {
    const ctx = await createSupplierContext();
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
    const ctx = await createSupplierContext();
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
    const ctx = await createSupplierContext();
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
    const ctx = await createSupplierContext();
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
    const ctxA = await createSupplierContext();
    const ctxB = await createSupplierContext();
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
});
