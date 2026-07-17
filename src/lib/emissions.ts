import { VehicleType } from "@/generated/prisma/client";

/**
 * Approximate gCO2e per tonne-km by vehicle type, loosely modeled after
 * GLEC Framework class averages (heavier/fuller trucks are more efficient
 * per tonne-km than smaller vehicles). These are illustrative fleet-average
 * factors, not measured or audited emissions — do not use for regulatory
 * or compliance reporting.
 */
export const VEHICLE_EMISSION_FACTORS: Record<VehicleType, number> = {
  [VehicleType.TIR]: 62,
  [VehicleType.KAMYON]: 90,
  [VehicleType.KAMYONET]: 180,
  [VehicleType.PANELVAN]: 250,
};

/** Estimated CO2e (kg) for a single shipment leg. */
export function calculateShipmentEmissionsKg(
  distanceKm: number,
  tonnage: number,
  vehicleType: VehicleType
): number {
  const gramsPerTonneKm = VEHICLE_EMISSION_FACTORS[vehicleType];
  return (distanceKm * tonnage * gramsPerTonneKm) / 1000;
}
