import type { DockReservation } from "@/generated/prisma/client";

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
