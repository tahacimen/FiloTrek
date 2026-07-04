import { NotificationType } from "@/generated/prisma/enums";

/**
 * Where clicking a notification should navigate. SHIPMENT_REQUESTED
 * deliberately goes to /assign, not the raw shipment detail page: the
 * shipment detail page's generic status-advance control only handles
 * transitions that need no extra data, and PENDING -> ASSIGNED needs a
 * vehicle+driver pick that only the assignment screen collects (see the
 * guard in shipment-status.ts). Routing here instead avoids ever landing a
 * dispatcher on a page that invites the wrong action for a fresh request.
 */
export function getNotificationLinkHref(notification: {
  type: NotificationType;
  relatedShipmentId: string | null;
}): string {
  switch (notification.type) {
    case NotificationType.SHIPMENT_REQUESTED:
      return "/assign";
    // LOAD_READY, VEHICLE_DEPARTED, PRICE_PROPOSED and PRICE_APPROVED all
    // just mean "go look at this shipment" — no extra data to collect first
    // — so they fall through to the default case below rather than needing
    // their own case.
    default:
      return notification.relatedShipmentId
        ? `/shipments/${notification.relatedShipmentId}`
        : "/dashboard";
  }
}
