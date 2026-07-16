import { afterAll, describe, expect, it } from "vitest";

import * as dockReservationService from "@/core/warehouse/dock-reservation-service";
import {
  cancelReservation,
  markCompleted,
  markVehicleArrived,
} from "@/core/warehouse/dock-reservation-status";
import { InvalidTransitionError, NotFoundError } from "@/core/shared/errors";
import {
  cleanupCompanies,
  createSupplierContext,
  createTestDock,
  createTestWarehouse,
} from "@/test/fixtures";

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
});
