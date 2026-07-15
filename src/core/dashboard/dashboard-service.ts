import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import * as vehicleRepository from "@/core/vehicle/vehicle-repository";
import * as driverRepository from "@/core/driver/driver-repository";
import * as shipmentRepository from "@/core/shipment/shipment-repository";
import {
  CompanyType,
  DriverStatus,
  VehicleStatus,
  VehicleType,
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

export async function getDashboardData(ctx: TenantContext) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);

  const [vehicleStatusGroups, driverStatusGroups, typeStatusGroups, sinceDate] =
    await Promise.all([
      vehicleRepository.countVehiclesByStatus(ctx),
      driverRepository.countDriversByStatus(ctx),
      vehicleRepository.countVehiclesByTypeAndStatus(ctx),
      Promise.resolve(
        new Date(Date.now() - TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000)
      ),
    ]);

  const vehiclesByStatus = emptyCountsByStatus(Object.values(VehicleStatus));
  for (const g of vehicleStatusGroups) vehiclesByStatus[g.status] = g._count;

  const driversByStatus = emptyCountsByStatus(Object.values(DriverStatus));
  for (const g of driverStatusGroups) driversByStatus[g.status] = g._count;

  const totalVehicles = Object.values(vehiclesByStatus).reduce((a, b) => a + b, 0);

  const occupancyByType = Object.values(VehicleType).map((vehicleType) => {
    const rows = typeStatusGroups.filter((g) => g.vehicleType === vehicleType);
    const total = rows.reduce((sum, r) => sum + r._count, 0);
    const available =
      rows.find((r) => r.status === VehicleStatus.AVAILABLE)?._count ?? 0;
    const maintenance =
      rows.find((r) => r.status === VehicleStatus.MAINTENANCE)?._count ?? 0;
    const inUse = total - available - maintenance;
    return { vehicleType, total, available, inUse, maintenance };
  });

  const [completedRows, recentActivity, featuredShipment] = await Promise.all([
    shipmentRepository.getCompletedShipmentsPerDay(ctx, sinceDate),
    shipmentRepository.listRecentActivity(ctx, 6),
    shipmentRepository.getFeaturedShipmentForSupplier(ctx),
  ]);
  const featuredShipmentHistory = featuredShipment
    ? await shipmentRepository.getShipmentStatusHistory(featuredShipment.id)
    : [];
  const trendByDate = new Map<string, number>();
  for (let i = TREND_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    trendByDate.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of completedRows) {
    if (!row.completedAt) continue;
    const key = row.completedAt.toISOString().slice(0, 10);
    if (trendByDate.has(key)) {
      trendByDate.set(key, (trendByDate.get(key) ?? 0) + 1);
    }
  }
  const completedShipmentsTrend = Array.from(trendByDate.entries()).map(
    ([date, count]) => ({ date, count })
  );

  return {
    totalVehicles,
    availableVehicles: vehiclesByStatus[VehicleStatus.AVAILABLE],
    enRouteVehicles: vehiclesByStatus[VehicleStatus.EN_ROUTE],
    idleDrivers: driversByStatus[DriverStatus.AVAILABLE],
    vehiclesByStatus,
    driversByStatus,
    occupancyByType,
    completedShipmentsTrend,
    recentActivity,
    featuredShipment,
    featuredShipmentHistory,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
