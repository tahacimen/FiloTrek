import type { Vehicle } from "@/generated/prisma/client";

/**
 * Prisma's `Decimal` is a class instance, not a plain object, so it cannot
 * cross the Server -> Client Component boundary as a prop. Vehicle is the
 * only entity with a Decimal field (tonnageCapacity) that flows into client
 * components (the CRUD table/dialog and the assignment screen), so it gets
 * converted to a plain number once, right where server data is fetched.
 */
export type SerializableVehicle = Omit<Vehicle, "tonnageCapacity"> & {
  tonnageCapacity: number;
};

export function toSerializableVehicle(vehicle: Vehicle): SerializableVehicle {
  return { ...vehicle, tonnageCapacity: vehicle.tonnageCapacity.toNumber() };
}
