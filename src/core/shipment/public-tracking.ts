import * as shipmentRepository from "@/core/shipment/shipment-repository";
import type { ShipmentStatus } from "@/generated/prisma/enums";

/**
 * The safe, public-facing projection of a shipment for the unauthenticated
 * /track page: route (city → city), current status, when it was created,
 * an open-incident flag, and the status timeline. Deliberately excludes
 * every commercial/sensitive field — price, company names, driver/vehicle,
 * documents, internal ids — so a bare tracking number never reveals more
 * than "where is my shipment in its journey."
 */
export type PublicTrackingResult = {
  trackingNumber: number;
  originAddress: string;
  destinationAddress: string;
  status: ShipmentStatus;
  createdAt: Date;
  hasOpenIncident: boolean;
  history: { toStatus: string; createdAt: Date }[];
  // Live position while genuinely in transit — same trust model as the
  // status/timeline above (a bare tracking number already reveals "where is
  // this in its journey"; a live pin is not a materially bigger disclosure).
  // Deliberately null once COMPLETED/CANCELLED — a stale pin next to a
  // finished shipment would be misleading, not informative.
  liveLocation: { lat: number; lng: number; at: Date } | null;
};

/** 8-digit tracking numbers start at 10000000; reject anything outside that shape early. */
export function parseTrackingNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\d{8,9}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) && n >= 10000000 ? n : null;
}

export async function trackShipmentByNumber(
  trackingNumber: number
): Promise<PublicTrackingResult | null> {
  const shipment =
    await shipmentRepository.getShipmentByTrackingNumber(trackingNumber);
  if (!shipment) return null;

  const history = await shipmentRepository.getShipmentStatusHistory(shipment.id);

  const isActive = shipment.status !== "COMPLETED" && shipment.status !== "CANCELLED";
  const liveLocation =
    isActive && shipment.lastKnownLat != null && shipment.lastKnownLng != null
      ? {
          lat: shipment.lastKnownLat.toNumber(),
          lng: shipment.lastKnownLng.toNumber(),
          at: shipment.lastLocationAt!,
        }
      : null;

  return {
    trackingNumber: shipment.trackingNumber,
    originAddress: shipment.originAddress,
    destinationAddress: shipment.destinationAddress,
    status: shipment.status,
    createdAt: shipment.createdAt,
    hasOpenIncident: shipment.hasOpenIncident,
    history: history.map((h) => ({ toStatus: h.toStatus, createdAt: h.createdAt })),
    liveLocation,
  };
}
