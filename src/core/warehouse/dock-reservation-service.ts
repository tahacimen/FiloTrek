import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import type { DriverContext } from "@/core/shared/driver-context";
import {
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from "@/core/shared/errors";
import * as warehouseRepository from "@/core/warehouse/warehouse-repository";
import * as dockReservationRepository from "@/core/warehouse/dock-reservation-repository";
import * as shipmentRepository from "@/core/shipment/shipment-repository";
import { reservationInputSchema } from "@/lib/validation/warehouse";
import { listOpenSlotsForDate } from "@/lib/dock-calendar";
import {
  CompanyType,
  DockReservationStatus,
  DockReservationType,
  ShipmentStatus,
} from "@/generated/prisma/client";

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

// ───────────────────────── D5: driver self-pick ──────────────────────────
//
// Flow: the CUSTOMER opens the dock calendar to the shipment's driver
// ("Takvimi Şoföre Gönder"). The DRIVER then picks any of the customer's
// loading docks + an open slot, which creates a REQUESTED reservation. The
// CUSTOMER approves (REQUESTED -> CREATED, flag cleared) or rejects
// (REQUESTED -> CANCELLED, flag kept so the driver can pick again).

/** Customer opens the dock calendar to the driver. Only before pickup, and only when no active reservation exists yet. */
export async function enableDriverDockSelection(
  ctx: TenantContext,
  shipmentId: string
) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const shipment = await shipmentRepository.getShipmentForCustomer(
    ctx,
    shipmentId
  );
  if (!shipment) throw new NotFoundError("Sefer bulunamadı.");
  if (shipment.status !== ShipmentStatus.ASSIGNED) {
    throw new ValidationError(
      "Takvim yalnızca araç atanmış, henüz yola çıkmamış seferlerde şoföre açılabilir."
    );
  }
  const existing =
    await dockReservationRepository.findActiveReservationForShipment(
      ctx,
      shipmentId
    );
  if (existing) {
    throw new ValidationError(
      "Bu seferin zaten aktif bir rampa rezervasyonu var."
    );
  }
  await shipmentRepository.setDriverDockSelectionEnabled(ctx, shipmentId, true);
}

/** Customer withdraws the calendar (before the driver has submitted a pick). */
export async function withdrawDriverDockSelection(
  ctx: TenantContext,
  shipmentId: string
) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const existing =
    await dockReservationRepository.findActiveReservationForShipment(
      ctx,
      shipmentId
    );
  if (existing) {
    throw new ValidationError(
      "Şoför bir saat seçmiş; önce talebi onaylayın veya reddedin."
    );
  }
  const result = await shipmentRepository.setDriverDockSelectionEnabled(
    ctx,
    shipmentId,
    false
  );
  if (result.count === 0) throw new NotFoundError("Sefer bulunamadı.");
}

export type DriverDockOption = {
  id: string;
  name: string;
  warehouseId: string;
  warehouseName: string;
  slotDurationMinutes: number;
  workingHours: {
    dayOfWeek: number;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
  }[];
};

/**
 * The customer's loading docks offered to the driver for a shipment whose
 * calendar has been opened to them. Returns [] (never throws) when the
 * driver isn't entitled to pick right now — the flag is off, the shipment
 * has moved on, or a pick/reservation already exists — so the page can
 * simply branch on an empty list.
 */
export async function listDockOptionsForDriver(
  driverCtx: DriverContext,
  shipmentId: string
): Promise<DriverDockOption[]> {
  const shipment = await shipmentRepository.getShipmentForDriver(
    driverCtx.driverId,
    shipmentId
  );
  if (
    !shipment ||
    !shipment.driverDockSelectionEnabled ||
    shipment.status !== ShipmentStatus.ASSIGNED
  ) {
    return [];
  }
  const existing =
    await dockReservationRepository.findActiveReservationForShipment(
      { companyId: driverCtx.companyId },
      shipmentId
    );
  if (existing) return [];

  const warehouses = await warehouseRepository.listWarehousesForCompanyId(
    shipment.customerCompanyId
  );
  return warehouses.flatMap((warehouse) =>
    warehouse.docks
      .filter((dock) =>
        dock.supportedReservationTypes.includes(DockReservationType.LOADING)
      )
      .map((dock) => ({
        id: dock.id,
        name: dock.name,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        slotDurationMinutes: dock.slotDurationMinutes,
        workingHours: dock.workingHours,
      }))
  );
}

/** Driver submits their chosen dock + slot; creates a REQUESTED reservation awaiting the customer's approval. */
export async function requestDockReservationAsDriver(
  driverCtx: DriverContext,
  shipmentId: string,
  dockId: string,
  startAt: Date
) {
  const shipment = await shipmentRepository.getShipmentForDriver(
    driverCtx.driverId,
    shipmentId
  );
  if (!shipment) throw new NotFoundError("Sefer bulunamadı.");
  if (!shipment.driverDockSelectionEnabled) {
    throw new ValidationError(
      "Bu sefer için rampa seçimi size açılmamış."
    );
  }
  if (shipment.status !== ShipmentStatus.ASSIGNED) {
    throw new ValidationError("Bu sefer için artık rampa seçilemez.");
  }
  if (!shipment.vehicle || !shipment.driver) {
    throw new ValidationError("Sefere henüz araç/şoför atanmamış.");
  }

  const existing =
    await dockReservationRepository.findActiveReservationForShipment(
      { companyId: driverCtx.companyId },
      shipmentId
    );
  if (existing) {
    throw new ValidationError(
      "Bu sefer için zaten bir rampa talebi/rezervasyonu var."
    );
  }

  const dock = await warehouseRepository.getDockForCompanyId(
    shipment.customerCompanyId,
    dockId
  );
  if (!dock) throw new NotFoundError("Rampa bulunamadı.");
  if (!dock.supportedReservationTypes.includes(DockReservationType.LOADING)) {
    throw new ValidationError("Bu rampa yükleme rezervasyonu desteklemiyor.");
  }

  // The chosen start must line up with one of the dock's open slot starts
  // for that day — a client can't submit an arbitrary off-hours time.
  const slotLabel = `${startAt.getHours().toString().padStart(2, "0")}:${startAt
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
  const openSlots = listOpenSlotsForDate(
    startAt,
    dock.workingHours,
    dock.slotDurationMinutes
  );
  if (!openSlots.includes(slotLabel)) {
    throw new ValidationError("Seçilen saat bu rampanın çalışma saatlerine uymuyor.");
  }
  if (startAt.getTime() < Date.now()) {
    throw new ValidationError("Geçmiş bir saat seçilemez.");
  }

  const endAt = new Date(
    startAt.getTime() + dock.slotDurationMinutes * 60_000
  );

  try {
    return await dockReservationRepository.createDriverRequestedReservationRecord(
      dockId,
      endAt,
      {
        reservationType: DockReservationType.LOADING,
        startAt,
        reason: "Şoför tarafından seçildi",
        vehicleType: shipment.vehicle.vehicleType,
        plate: shipment.vehicle.plate,
        driverName: shipment.driver.fullName,
        driverPhone: shipment.driver.phone,
        shipmentId,
      }
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

/** Customer approves the driver's requested slot: REQUESTED -> CREATED, and the calendar flag is cleared. */
export async function approveDriverReservation(
  ctx: TenantContext,
  reservationId: string
) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const result = await dockReservationRepository.approveRequestedReservation(
    ctx,
    reservationId
  );
  if (result.kind === "not_found") {
    throw new NotFoundError("Rezervasyon bulunamadı.");
  }
  if (result.kind === "invalid_transition") {
    throw new InvalidTransitionError("Bu talep artık onaylanamaz.");
  }
  if (result.reservation.shipmentId) {
    await shipmentRepository.setDriverDockSelectionEnabled(
      ctx,
      result.reservation.shipmentId,
      false
    );
  }
  return result.reservation;
}

/** Customer rejects the driver's requested slot: REQUESTED -> CANCELLED. The calendar stays open so the driver can pick again. */
export async function rejectDriverReservation(
  ctx: TenantContext,
  reservationId: string
) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const result = await dockReservationRepository.transitionReservationStatus(
    ctx,
    reservationId,
    [DockReservationStatus.REQUESTED],
    DockReservationStatus.CANCELLED,
    "cancelledAt"
  );
  if (result.kind === "not_found") {
    throw new NotFoundError("Rezervasyon bulunamadı.");
  }
  if (result.kind === "invalid_transition") {
    throw new InvalidTransitionError("Bu talep artık reddedilemez.");
  }
  return result.reservation;
}
