import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import * as vehicleRepository from "@/core/vehicle/vehicle-repository";
import * as driverRepository from "@/core/driver/driver-repository";
import * as shipmentRepository from "@/core/shipment/shipment-repository";
import {
  CompanyType,
  DriverStatus,
  VehicleStatus,
} from "@/generated/prisma/client";

const TREND_WINDOW_DAYS = 14;

function emptyCountsByStatus<T extends string>(statuses: T[]) {
  return statuses.reduce(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<T, number>
  );
}

const REVENUE_WINDOW_MONTHS = 6;

/** Buckets a list of dates into a trailing TREND_WINDOW_DAYS series of {date, count}, zero-filled for days with no rows. */
function bucketByDay(dates: Date[]) {
  const trendByDate = new Map<string, number>();
  for (let i = TREND_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    trendByDate.set(d.toISOString().slice(0, 10), 0);
  }
  for (const date of dates) {
    const key = date.toISOString().slice(0, 10);
    if (trendByDate.has(key)) {
      trendByDate.set(key, (trendByDate.get(key) ?? 0) + 1);
    }
  }
  return Array.from(trendByDate.entries()).map(([date, count]) => ({ date, count }));
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Buckets completed shipments into the trailing REVENUE_WINDOW_MONTHS as
 * {month: "YYYY-MM", revenue, count}, zero-filled for empty months. UTC to
 * match the server (Vercel runs UTC) and avoid month-boundary drift.
 */
function bucketByMonth(rows: { completedAt: Date | null; revenue: number }[]) {
  const buckets = new Map<string, { revenue: number; count: number }>();
  const now = new Date();
  for (let i = REVENUE_WINDOW_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.set(monthKey(d), { revenue: 0, count: 0 });
  }
  for (const row of rows) {
    if (!row.completedAt) continue;
    const bucket = buckets.get(monthKey(row.completedAt));
    if (bucket) {
      bucket.revenue += row.revenue;
      bucket.count += 1;
    }
  }
  return Array.from(buckets.entries()).map(([month, v]) => ({
    month,
    revenue: v.revenue,
    count: v.count,
  }));
}

/**
 * The "derin operasyonel KPI'lar" (deep operational KPIs) — usable by
 * either dashboard branch (getDashboardData below is SUPPLIER-only, but
 * this itself has no role restriction; the CUSTOMER dashboard page calls
 * it directly for its own, smaller KPI card).
 */
export async function getOperationalKpis(ctx: TenantContext) {
  const [onTimePickupRate, averagePricePerKm, volumeRows, incidentRate] =
    await Promise.all([
      shipmentRepository.getOnTimePickupRate(ctx),
      shipmentRepository.getAveragePricePerKm(ctx),
      shipmentRepository.getShipmentVolumeTrend(
        ctx,
        new Date(Date.now() - TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000)
      ),
      shipmentRepository.getIncidentRate(ctx),
    ]);

  return {
    onTimePickupRate,
    averagePricePerKm,
    incidentRate,
    shipmentVolumeTrend: bucketByDay(volumeRows.map((r) => r.createdAt)),
  };
}

export type OperationalKpis = Awaited<ReturnType<typeof getOperationalKpis>>;

export async function getDashboardData(ctx: TenantContext) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);

  const revenueSince = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (REVENUE_WINDOW_MONTHS - 1), 1)
  );

  const [
    vehicleStatusGroups,
    driverStatusGroups,
    revenueRows,
    recentActivity,
    featuredShipment,
    operationalKpis,
  ] = await Promise.all([
    vehicleRepository.countVehiclesByStatus(ctx),
    driverRepository.countDriversByStatus(ctx),
    shipmentRepository.getCompletedShipmentRevenueSince(ctx, revenueSince),
    shipmentRepository.listRecentActivity(ctx, 6),
    shipmentRepository.getFeaturedShipmentForSupplier(ctx),
    getOperationalKpis(ctx),
  ]);

  const vehiclesByStatus = emptyCountsByStatus(Object.values(VehicleStatus));
  for (const g of vehicleStatusGroups) vehiclesByStatus[g.status] = g._count;

  const driversByStatus = emptyCountsByStatus(Object.values(DriverStatus));
  for (const g of driverStatusGroups) driversByStatus[g.status] = g._count;

  const totalVehicles = Object.values(vehiclesByStatus).reduce((a, b) => a + b, 0);

  const featuredShipmentHistory = featuredShipment
    ? await shipmentRepository.getShipmentStatusHistory(featuredShipment.id)
    : [];

  return {
    totalVehicles,
    availableVehicles: vehiclesByStatus[VehicleStatus.AVAILABLE],
    enRouteVehicles: vehiclesByStatus[VehicleStatus.EN_ROUTE],
    idleDrivers: driversByStatus[DriverStatus.AVAILABLE],
    monthlyRevenueTrend: bucketByMonth(revenueRows),
    operationalKpis,
    recentActivity,
    featuredShipment,
    featuredShipmentHistory,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
