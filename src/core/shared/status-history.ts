import type { Prisma } from "@/generated/prisma/client";
import { StatusChangeSource, StatusEntityType } from "@/generated/prisma/client";

/**
 * Writes one audit trail row for a Vehicle/Driver/Shipment status transition.
 * Always called inside the same Prisma transaction as the status update
 * itself, using `tx` instead of the shared `prisma` client, so the state
 * change and its audit record can never drift apart.
 */
export function recordStatusChange(
  tx: Prisma.TransactionClient,
  params: {
    entityType: StatusEntityType;
    entityId: string;
    fromStatus: string | null;
    toStatus: string;
    changedByUserId?: string | null;
    changedByDriverId?: string | null;
    source: StatusChangeSource;
    sourceReference?: string | null;
    photoUrl?: string | null;
  }
) {
  return tx.statusHistory.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      changedByUserId: params.changedByUserId ?? null,
      changedByDriverId: params.changedByDriverId ?? null,
      source: params.source,
      sourceReference: params.sourceReference ?? null,
      photoUrl: params.photoUrl ?? null,
    },
  });
}
