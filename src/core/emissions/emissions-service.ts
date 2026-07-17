import type { TenantContext } from "@/core/shared/tenant-context";
import * as shipmentRepository from "@/core/shipment/shipment-repository";
import { calculateShipmentEmissionsKg } from "@/lib/emissions";

const SUMMARY_WINDOW_MONTHS = 12;

/**
 * Total + monthly estimated CO2e for a company's completed shipments over
 * the trailing window (default 12 months). Estimates only — see the
 * disclaimer on VEHICLE_EMISSION_FACTORS in src/lib/emissions.ts.
 */
export async function getCompanyEmissionsSummary(
  ctx: TenantContext,
  range?: { from: Date; to: Date }
) {
  const to = range?.to ?? new Date();
  const from =
    range?.from ?? new Date(to.getFullYear(), to.getMonth() - (SUMMARY_WINDOW_MONTHS - 1), 1);

  const shipments = await shipmentRepository.getCompletedShipmentsForEmissions(
    ctx,
    from,
    to
  );

  const byMonth = new Map<string, number>();
  let totalKg = 0;

  for (const shipment of shipments) {
    // A COMPLETED shipment always has a vehicle assigned by the time it gets
    // there (assignVehicleAndDriver runs before any status advance past
    // PENDING) — this null-check is defensive, not a real runtime path.
    if (!shipment.vehicle || !shipment.completedAt) continue;

    const kg = calculateShipmentEmissionsKg(
      shipment.distanceKm.toNumber(),
      shipment.tonnage.toNumber(),
      shipment.vehicle.vehicleType
    );
    totalKg += kg;

    const monthKey = shipment.completedAt.toISOString().slice(0, 7);
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + kg);
  }

  return {
    totalKg,
    byMonth: Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, kg]) => ({ month, kg })),
  };
}

export type CompanyEmissionsSummary = Awaited<
  ReturnType<typeof getCompanyEmissionsSummary>
>;
