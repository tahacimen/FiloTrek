import type { GateGuard } from "@/generated/prisma/client";

/**
 * `passwordHash` must never cross the Server -> Client Component boundary —
 * same rationale as SerializableDriver in drivers/types.ts.
 */
export type SerializableGateGuard = Omit<GateGuard, "passwordHash">;

export function toSerializableGateGuard(
  gateGuard: GateGuard
): SerializableGateGuard {
  const { passwordHash: _passwordHash, ...rest } = gateGuard;
  return rest;
}
