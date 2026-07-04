import type { GateGuardContext } from "@/core/shared/gate-guard-context";
import { InvalidTransitionError, NotFoundError } from "@/core/shared/errors";
import * as gateEventRepository from "@/core/gate-guard/gate-event-repository";
import * as notificationService from "@/core/notification/notification-service";
import { GateEventType } from "@/generated/prisma/client";

/** No requireCompanyType-style guard needed — GateGuardContext is only ever obtainable via requireGateGuardContext(), and that session's companyId is always a CUSTOMER company (see createGateGuard). */
export async function listActiveShipmentsForGateGuard(
  gateGuardCtx: GateGuardContext
) {
  return gateEventRepository.listActiveShipmentsForGateGuard(
    gateGuardCtx.companyId
  );
}

/**
 * Logs a vehicle entry or exit for a shipment — server-side enforced, not
 * just via which button the UI happens to show, same "never trust the
 * client alone" posture as the driver's mandatory photo check. Unlike a
 * simple in/out toggle, VEHICLE_EXITED is terminal: once logged, this
 * shipment is done from the gate guard's own point of view (they move it
 * to their "Tamamlanan" list) and no further event of either type can be
 * logged against it — a vehicle physically returning after leaving isn't a
 * scenario this screen models, by product decision, not an oversight.
 */
export async function logGateEvent(
  gateGuardCtx: GateGuardContext,
  shipmentId: string,
  eventType: GateEventType
) {
  const shipment = await gateEventRepository.getShipmentForGateGuard(
    gateGuardCtx.companyId,
    shipmentId
  );
  if (!shipment) throw new NotFoundError("Sefer bulunamadı.");

  const latestEvent = shipment.gateEvents[0] ?? null;
  const currentlyInside = latestEvent?.eventType === GateEventType.VEHICLE_ENTERED;
  const alreadyExited = latestEvent?.eventType === GateEventType.VEHICLE_EXITED;

  if (alreadyExited) {
    throw new InvalidTransitionError(
      "Bu sefer için nizamiye kaydı tamamlandı, yeni işlem yapılamaz."
    );
  }
  if (eventType === GateEventType.VEHICLE_ENTERED && currentlyInside) {
    throw new InvalidTransitionError("Araç zaten giriş yapmış durumda.");
  }
  if (eventType === GateEventType.VEHICLE_EXITED && !currentlyInside) {
    throw new InvalidTransitionError("Araç henüz giriş yapmamış.");
  }

  const event = await gateEventRepository.createGateEvent(
    gateGuardCtx,
    shipmentId,
    eventType
  );

  try {
    const notify =
      eventType === GateEventType.VEHICLE_ENTERED
        ? notificationService.notifyVehicleEnteredGate
        : notificationService.notifyVehicleExitedGate;
    await notify({
      customerCompanyId: gateGuardCtx.companyId,
      gateGuardName: gateGuardCtx.fullName,
      shipment,
    });
  } catch (error) {
    console.error("Nizamiye bildirimi oluşturulamadı:", error);
  }

  return event;
}
