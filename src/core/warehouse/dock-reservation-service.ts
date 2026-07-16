import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import * as warehouseRepository from "@/core/warehouse/warehouse-repository";
import * as dockReservationRepository from "@/core/warehouse/dock-reservation-repository";
import * as shipmentRepository from "@/core/shipment/shipment-repository";
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
  requireCompanyType(ctx, CompanyType.CUSTOMER);
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
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const dock = await warehouseRepository.getDockForTenant(ctx, dockId);
  if (!dock) throw new NotFoundError("Rampa bulunamadı.");

  const input = reservationInputSchema.parse(rawInput);
  if (!dock.supportedReservationTypes.includes(input.reservationType)) {
    throw new ValidationError(
      "Bu rampa seçilen rezervasyon tipini desteklemiyor."
    );
  }

  if (input.shipmentId) {
    const shipment = await shipmentRepository.getShipmentForCustomer(
      ctx,
      input.shipmentId
    );
    if (!shipment) throw new NotFoundError("Sefer bulunamadı.");

    const alreadyLinked =
      await dockReservationRepository.findActiveReservationForShipment(
        ctx,
        input.shipmentId
      );
    if (alreadyLinked) {
      throw new ValidationError(
        "Bu sefer zaten başka bir aktif rampa rezervasyonuna bağlı."
      );
    }
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

/**
 * For the shipment detail page's "Depo Rampa Rezervasyonu" card — no
 * requireCompanyType restriction, since both sides of the shipment can read
 * it (customer manages it, supplier only ever sees it read-only). The
 * repository's own OR-scoped query already restricts results to a
 * reservation this specific ctx.companyId is actually entitled to see.
 */
export async function getActiveReservationForShipment(
  ctx: TenantContext,
  shipmentId: string
) {
  return dockReservationRepository.findActiveReservationForShipment(
    ctx,
    shipmentId
  );
}
