import { ShipmentStatus, VehicleStatus } from "@/generated/prisma/enums";

/**
 * Single source of truth for which shipment statuses can follow which.
 * Deliberately has zero dependency on the Prisma client runtime (only the
 * lightweight generated enum module) so both server code and client
 * components (e.g. status action buttons) can import it directly.
 */
export const SHIPMENT_ALLOWED_TRANSITIONS: Record<
  ShipmentStatus,
  ShipmentStatus[]
> = {
  [ShipmentStatus.PENDING]: [ShipmentStatus.ASSIGNED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.ASSIGNED]: [
    ShipmentStatus.HEADING_TO_PICKUP,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.HEADING_TO_PICKUP]: [
    ShipmentStatus.LOADING,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.LOADING]: [
    ShipmentStatus.AT_PICKUP_GATE,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.AT_PICKUP_GATE]: [
    ShipmentStatus.EN_ROUTE,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.EN_ROUTE]: [
    ShipmentStatus.AT_DELIVERY_POINT,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.AT_DELIVERY_POINT]: [
    ShipmentStatus.COMPLETED,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.COMPLETED]: [],
  [ShipmentStatus.CANCELLED]: [],
};

export const SHIPMENT_TO_VEHICLE_STATUS: Partial<
  Record<ShipmentStatus, VehicleStatus>
> = {
  [ShipmentStatus.ASSIGNED]: VehicleStatus.ASSIGNED,
  [ShipmentStatus.HEADING_TO_PICKUP]: VehicleStatus.HEADING_TO_PICKUP,
  [ShipmentStatus.LOADING]: VehicleStatus.LOADING,
  // Still physically at the loading site, just at the specific gate rather
  // than the broader pickup area — no distinct VehicleStatus of its own.
  [ShipmentStatus.AT_PICKUP_GATE]: VehicleStatus.LOADING,
  [ShipmentStatus.EN_ROUTE]: VehicleStatus.EN_ROUTE,
  [ShipmentStatus.AT_DELIVERY_POINT]: VehicleStatus.AT_DELIVERY_POINT,
};

/**
 * The single next status a driver can report from their own scoped view,
 * keyed by the shipment's CURRENT status (not the target) so a UI can look
 * up "what's my next action" directly. A strict subset of
 * SHIPMENT_ALLOWED_TRANSITIONS — ASSIGNED (needs a dispatcher-picked
 * vehicle+driver) and HEADING_TO_PICKUP's own entry (dispatcher confirms
 * departure) are deliberately absent, matching
 * DRIVER_ALLOWED_TARGET_STATUSES in shipment-status.ts.
 */
export const DRIVER_NEXT_TARGET_STATUS: Partial<
  Record<ShipmentStatus, ShipmentStatus>
> = {
  [ShipmentStatus.HEADING_TO_PICKUP]: ShipmentStatus.LOADING,
  [ShipmentStatus.LOADING]: ShipmentStatus.AT_PICKUP_GATE,
  [ShipmentStatus.AT_PICKUP_GATE]: ShipmentStatus.EN_ROUTE,
  [ShipmentStatus.EN_ROUTE]: ShipmentStatus.AT_DELIVERY_POINT,
  [ShipmentStatus.AT_DELIVERY_POINT]: ShipmentStatus.COMPLETED,
};

/**
 * The canonical linear order of the (non-terminal-branch) happy-path
 * statuses — drives the step-by-step timeline on the shipment detail page.
 * CANCELLED is deliberately excluded: it can be reached from any
 * non-terminal status, so it doesn't have one fixed position in a linear
 * sequence — the timeline handles it as a special case instead of a step.
 */
export const SHIPMENT_STATUS_SEQUENCE: ShipmentStatus[] = [
  ShipmentStatus.PENDING,
  ShipmentStatus.ASSIGNED,
  ShipmentStatus.HEADING_TO_PICKUP,
  ShipmentStatus.LOADING,
  ShipmentStatus.AT_PICKUP_GATE,
  ShipmentStatus.EN_ROUTE,
  ShipmentStatus.AT_DELIVERY_POINT,
  ShipmentStatus.COMPLETED,
];

export function getNextShipmentSteps(status: ShipmentStatus) {
  return SHIPMENT_ALLOWED_TRANSITIONS[status].filter(
    (s) => s !== ShipmentStatus.CANCELLED
  );
}

/**
 * How far along SHIPMENT_STATUS_SEQUENCE a shipment is, as a 0–100 percent —
 * the single source of truth behind both the detail page's timeline bar and
 * the dashboard's activity-list progress bars, so the two never drift apart.
 * CANCELLED has no fixed position in the sequence (see the comment above),
 * so callers must branch on that themselves rather than call this for it.
 */
export function getShipmentProgressPercent(status: ShipmentStatus): number {
  const index = SHIPMENT_STATUS_SEQUENCE.indexOf(status);
  if (index === -1) return 0;
  return Math.round((index / (SHIPMENT_STATUS_SEQUENCE.length - 1)) * 100);
}

export function canCancelShipment(status: ShipmentStatus) {
  return SHIPMENT_ALLOWED_TRANSITIONS[status].includes(
    ShipmentStatus.CANCELLED
  );
}
