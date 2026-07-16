import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import * as warehouseRepository from "@/core/warehouse/warehouse-repository";
import * as dockReservationRepository from "@/core/warehouse/dock-reservation-repository";
import { countOpenSlotsInRange } from "@/lib/dock-calendar";
import {
  CompanyType,
  DockReservationStatus,
  DockReservationType,
} from "@/generated/prisma/client";

export type DockOccupancyRow = {
  warehouseName: string;
  dockName: string;
  dockId: string;
  reservationCount: number;
  openSlotCount: number;
  occupancyPct: number;
};

export type ReservationReport = {
  totalReservations: number;
  statusCounts: Record<DockReservationStatus, number>;
  typeCounts: Record<DockReservationType, number>;
  overallOccupancyPct: number;
  perDock: DockOccupancyRow[];
  dailyTrend: { date: string; count: number }[];
};

function emptyCounts<T extends string>(values: T[]): Record<T, number> {
  return values.reduce(
    (acc, v) => {
      acc[v] = 0;
      return acc;
    },
    {} as Record<T, number>
  );
}

/**
 * Company-wide reservation report across every warehouse/dock, for an
 * arbitrary [rangeStart, rangeEnd) date range — distinct from the per-dock
 * "Doluluk Özeti" on the dock detail page, which is scoped to one dock's
 * current calendar week. Occupancy % is real-data-derived (booked slot
 * count / bookable slot count from actual working hours), never a guessed
 * or fabricated figure.
 */
export async function getReservationReport(
  ctx: TenantContext,
  rangeStart: Date,
  rangeEnd: Date
): Promise<ReservationReport> {
  requireCompanyType(ctx, CompanyType.CUSTOMER);

  const [warehouses, reservations] = await Promise.all([
    warehouseRepository.listWarehousesForTenant(ctx),
    dockReservationRepository.listReservationsForCompanyInRange(
      ctx,
      rangeStart,
      rangeEnd
    ),
  ]);

  const statusCounts = emptyCounts(Object.values(DockReservationStatus));
  const typeCounts = emptyCounts(Object.values(DockReservationType));
  const reservationsByDock = new Map<string, typeof reservations>();
  for (const reservation of reservations) {
    statusCounts[reservation.status]++;
    typeCounts[reservation.reservationType]++;
    const list = reservationsByDock.get(reservation.dockId) ?? [];
    list.push(reservation);
    reservationsByDock.set(reservation.dockId, list);
  }

  const perDock: DockOccupancyRow[] = [];
  let totalBookedSlots = 0;
  let totalOpenSlots = 0;
  for (const warehouse of warehouses) {
    for (const dock of warehouse.docks) {
      const dockReservations = reservationsByDock.get(dock.id) ?? [];
      const bookedCount = dockReservations.filter(
        (r) => r.status !== DockReservationStatus.CANCELLED
      ).length;
      const openSlotCount = countOpenSlotsInRange(
        dock.workingHours,
        dock.slotDurationMinutes,
        rangeStart,
        rangeEnd
      );
      totalBookedSlots += bookedCount;
      totalOpenSlots += openSlotCount;
      perDock.push({
        warehouseName: warehouse.name,
        dockName: dock.name,
        dockId: dock.id,
        reservationCount: dockReservations.length,
        openSlotCount,
        occupancyPct:
          openSlotCount > 0 ? Math.round((bookedCount / openSlotCount) * 100) : 0,
      });
    }
  }

  // Zero-filled day-by-day trend across the range — legitimate (not
  // fabricated) since every reservation carries a real startAt; mirrors
  // dashboard-service.ts's completedShipmentsTrend zero-fill pattern.
  const trendByDate = new Map<string, number>();
  let cursor = new Date(
    rangeStart.getFullYear(),
    rangeStart.getMonth(),
    rangeStart.getDate()
  );
  while (cursor < rangeEnd) {
    trendByDate.set(cursor.toISOString().slice(0, 10), 0);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  for (const reservation of reservations) {
    const key = reservation.startAt.toISOString().slice(0, 10);
    if (trendByDate.has(key)) {
      trendByDate.set(key, (trendByDate.get(key) ?? 0) + 1);
    }
  }
  const dailyTrend = Array.from(trendByDate.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  return {
    totalReservations: reservations.length,
    statusCounts,
    typeCounts,
    overallOccupancyPct:
      totalOpenSlots > 0 ? Math.round((totalBookedSlots / totalOpenSlots) * 100) : 0,
    perDock,
    dailyTrend,
  };
}
