import { afterAll, describe, expect, it } from "vitest";

import { getReservationReport } from "@/core/warehouse/dock-reservation-report-service";
import * as dockReservationService from "@/core/warehouse/dock-reservation-service";
import { cancelReservation } from "@/core/warehouse/dock-reservation-status";
import {
  cleanupCompanies,
  createSupplierContext,
  createTestDock,
  createTestWarehouse,
} from "@/test/fixtures";

function dayAt(dayOffset: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const baseReservationInput = {
  reservationType: "LOADING" as const,
  reason: "Palet yükleme",
  plate: "34 RPT 001",
  driverName: "Test Sürücü",
};

describe("dock-reservation-report-service", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("aggregates status/type counts and occupancy across every dock, excluding cancelled reservations from occupancy", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const warehouse = await createTestWarehouse(ctx.companyId);
    // slotDurationMinutes=60, working hours 00:00-23:00 every day (fixture
    // default) -> 23 bookable slots/day for this single dock.
    const dock = await createTestDock(warehouse.id, { slotDurationMinutes: 60 });

    const rangeStart = dayAt(3, 0);
    const rangeEnd = dayAt(4, 0); // exactly one day window

    const kept = await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      startAt: dayAt(3, 9),
    });
    const toCancel = await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      plate: "34 RPT 002",
      startAt: dayAt(3, 10),
    });
    await cancelReservation(ctx, toCancel.id);

    const report = await getReservationReport(ctx, rangeStart, rangeEnd);

    expect(report.totalReservations).toBe(2);
    expect(report.statusCounts.CREATED).toBe(1);
    expect(report.statusCounts.CANCELLED).toBe(1);
    expect(report.typeCounts.LOADING).toBe(2);

    const row = report.perDock.find((r) => r.dockId === dock.id);
    expect(row).toBeDefined();
    expect(row!.reservationCount).toBe(2);
    expect(row!.openSlotCount).toBe(23);
    // Only the non-cancelled reservation counts toward booked slots: 1/23 ≈ 4%.
    expect(row!.occupancyPct).toBe(Math.round((1 / 23) * 100));
    expect(kept.status).toBe("CREATED");
  });

  it("zero-fills every day in the range for the daily trend, real data only", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const warehouse = await createTestWarehouse(ctx.companyId);
    const dock = await createTestDock(warehouse.id, { slotDurationMinutes: 60 });

    const rangeStart = dayAt(5, 0);
    const rangeEnd = dayAt(8, 0); // 3-day window, only day 6 has a reservation

    await dockReservationService.createReservation(ctx, dock.id, {
      ...baseReservationInput,
      startAt: dayAt(6, 9),
    });

    const report = await getReservationReport(ctx, rangeStart, rangeEnd);
    expect(report.dailyTrend).toHaveLength(3);
    const nonZeroDays = report.dailyTrend.filter((d) => d.count > 0);
    expect(nonZeroDays).toHaveLength(1);
    expect(nonZeroDays[0].count).toBe(1);
  });

  it("only includes reservations from the tenant's own warehouses", async () => {
    const ctxA = await createSupplierContext();
    const ctxB = await createSupplierContext();
    companyIds.push(ctxA.companyId, ctxB.companyId);
    const warehouseA = await createTestWarehouse(ctxA.companyId);
    const dockA = await createTestDock(warehouseA.id);
    const warehouseB = await createTestWarehouse(ctxB.companyId);
    const dockB = await createTestDock(warehouseB.id);

    const rangeStart = dayAt(10, 0);
    const rangeEnd = dayAt(11, 0);

    await dockReservationService.createReservation(ctxA, dockA.id, {
      ...baseReservationInput,
      startAt: dayAt(10, 9),
    });
    await dockReservationService.createReservation(ctxB, dockB.id, {
      ...baseReservationInput,
      startAt: dayAt(10, 9),
    });

    const reportA = await getReservationReport(ctxA, rangeStart, rangeEnd);
    expect(reportA.totalReservations).toBe(1);
    expect(reportA.perDock.map((r) => r.dockId)).toEqual([dockA.id]);
  });
});
