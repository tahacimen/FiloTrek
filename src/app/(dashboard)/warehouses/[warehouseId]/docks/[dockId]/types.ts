import type { DockReservation, VehicleType } from "@/generated/prisma/client";

/**
 * Prisma's `Decimal` (totalWeightKg) can't cross the Server -> Client
 * Component boundary as a plain prop — same reasoning as Vehicle's
 * tonnageCapacity in vehicles/types.ts.
 */
export type SerializableReservation = Omit<DockReservation, "totalWeightKg"> & {
  totalWeightKg: number | null;
};

export function toSerializableReservation(
  reservation: DockReservation
): SerializableReservation {
  return {
    ...reservation,
    totalWeightKg: reservation.totalWeightKg
      ? reservation.totalWeightKg.toNumber()
      : null,
  };
}

/**
 * Picker option for linking a reservation to one of the supplier's own
 * shipments — deliberately narrow (no Decimal fields like distanceKm/
 * tonnage/agreedPrice) so it needs no serialization step at all before
 * crossing into a Client Component.
 */
export type AssignableShipmentOption = {
  id: string;
  trackingNumber: number;
  originAddress: string;
  destinationAddress: string;
  vehicle: { plate: string; vehicleType: VehicleType } | null;
  driver: { fullName: string; phone: string } | null;
};

export function toAssignableShipmentOption(shipment: {
  id: string;
  trackingNumber: number;
  originAddress: string;
  destinationAddress: string;
  vehicle: { plate: string; vehicleType: VehicleType } | null;
  driver: { fullName: string; phone: string } | null;
}): AssignableShipmentOption {
  return {
    id: shipment.id,
    trackingNumber: shipment.trackingNumber,
    originAddress: shipment.originAddress,
    destinationAddress: shipment.destinationAddress,
    vehicle: shipment.vehicle
      ? { plate: shipment.vehicle.plate, vehicleType: shipment.vehicle.vehicleType }
      : null,
    driver: shipment.driver
      ? { fullName: shipment.driver.fullName, phone: shipment.driver.phone }
      : null,
  };
}
