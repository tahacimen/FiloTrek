import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import * as warehouseRepository from "@/core/warehouse/warehouse-repository";
import * as dockReservationRepository from "@/core/warehouse/dock-reservation-repository";
import { reservationInputSchema } from "@/lib/validation/warehouse";
import { CompanyType } from "@/generated/prisma/client";

/**
 * The DB-level EXCLUDE constraint (dock_reservations_no_overlap, see the
 * add_dock_reservation_system migration) is what actually prevents two
 * overlapping reservations under concurrent requests — Prisma has no
 * concept of exclusion constraints, so a violation surfaces as a generic
 * driver-adapter error rather than a typed Prisma error code. Detected by
 * matching the constraint's own name in the message, confirmed empirically
 * against a real Postgres instance rather than assumed.
 */
function isOverlapViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("dock_reservations_no_overlap")
  );
}

export async function listReservationsForWeek(
  ctx: TenantContext,
  dockId: string,
  weekStart: Date,
  weekEnd: Date
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  return dockReservationRepository.listReservationsForDock(
    ctx,
    dockId,
    weekStart,
    weekEnd
  );
}

export async function createReservation(
  ctx: TenantContext,
  dockId: string,
  rawInput: unknown
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const dock = await warehouseRepository.getDockForTenant(ctx, dockId);
  if (!dock) throw new NotFoundError("Rampa bulunamadı.");

  const input = reservationInputSchema.parse(rawInput);
  if (!dock.supportedReservationTypes.includes(input.reservationType)) {
    throw new ValidationError(
      "Bu rampa seçilen rezervasyon tipini desteklemiyor."
    );
  }

  const endAt = new Date(
    input.startAt.getTime() + dock.slotDurationMinutes * 60_000
  );

  try {
    return await dockReservationRepository.createReservationRecord(
      dockId,
      endAt,
      input
    );
  } catch (error) {
    if (isOverlapViolation(error)) {
      throw new ValidationError(
        "Bu rampa için seçilen saat aralığında zaten bir rezervasyon var."
      );
    }
    throw error;
  }
}
