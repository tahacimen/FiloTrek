import { prisma } from "@/lib/db";
import type { TenantContext } from "@/core/shared/tenant-context";
import {
  CompanyType,
  ShipmentStatus,
  StatusEntityType,
} from "@/generated/prisma/client";

const shipmentListInclude = {
  customerCompany: { select: { id: true, name: true } },
  supplierCompany: { select: { id: true, name: true } },
  vehicle: {
    select: { id: true, plate: true, vehicleType: true, bedType: true },
  },
  driver: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      licenseNumber: true,
      experienceYears: true,
    },
  },
} as const;

/** A shipment is visible to both the customer and the supplier side of it. */
function tenantVisibilityFilter(ctx: TenantContext) {
  return {
    OR: [
      { customerCompanyId: ctx.companyId },
      { supplierCompanyId: ctx.companyId },
    ],
  };
}

export function listShipmentsForTenant(ctx: TenantContext) {
  return prisma.shipment.findMany({
    where: tenantVisibilityFilter(ctx),
    include: shipmentListInclude,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Shipments a customer can link a dock reservation to from the standalone
 * calendar's optional picker: already has a vehicle/driver (ASSIGNED or
 * later, so the reservation form can autofill plate/driver) and hasn't
 * finished yet — see dock-reservation-service.ts. The primary reservation
 * flow is shipment-scoped instead (a "Rampa Rezervasyonu Yap" action on the
 * shipment's own detail page), where this picker isn't needed at all.
 */
const DOCK_RESERVATION_ASSIGNABLE_STATUSES = [
  ShipmentStatus.ASSIGNED,
  ShipmentStatus.HEADING_TO_PICKUP,
  ShipmentStatus.LOADING,
  ShipmentStatus.AT_PICKUP_GATE,
];

export function listAssignableShipmentsForDockReservation(ctx: TenantContext) {
  return prisma.shipment.findMany({
    where: {
      customerCompanyId: ctx.companyId,
      status: { in: DOCK_RESERVATION_ASSIGNABLE_STATUSES },
    },
    include: shipmentListInclude,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Ownership check only (not full visibility) — used before linking a dock
 * reservation to a shipment, distinct from getShipmentForTenant below which
 * also allows the supplier side to read it.
 */
export function getShipmentForCustomer(ctx: TenantContext, shipmentId: string) {
  return prisma.shipment.findFirst({
    where: { id: shipmentId, customerCompanyId: ctx.companyId },
  });
}

export function getShipmentForTenant(ctx: TenantContext, shipmentId: string) {
  return prisma.shipment.findFirst({
    where: { id: shipmentId, ...tenantVisibilityFilter(ctx) },
    include: shipmentListInclude,
  });
}

/** A driver only ever sees their own currently-active (not finished) shipments. */
export function listActiveShipmentsForDriver(driverId: string) {
  return prisma.shipment.findMany({
    where: {
      driverId,
      status: {
        notIn: [ShipmentStatus.COMPLETED, ShipmentStatus.CANCELLED],
      },
    },
    include: shipmentListInclude,
    orderBy: { createdAt: "desc" },
  });
}

/** Scoped to the customer side specifically — markLoadReady is a customer-only action. */
export function getShipmentOwnedByCustomer(
  ctx: TenantContext,
  shipmentId: string
) {
  return prisma.shipment.findFirst({
    where: { id: shipmentId, customerCompanyId: ctx.companyId },
    include: shipmentListInclude,
  });
}

type CreateShipmentRecordInput = {
  customerCompanyId: string;
  supplierCompanyId: string;
  originAddress: string;
  originMapsUrl?: string;
  destinationAddress: string;
  destinationMapsUrl?: string;
  distanceKm: number;
  tonnage: number;
  cargoDescription?: string;
  documentTrackingNumber?: string;
};

/**
 * Persists a shipment for an already-resolved, already-authorized pair of
 * company ids. Takes both ids explicitly rather than a TenantContext —
 * callers (shipment-service.ts) are responsible for proving one side is the
 * caller's own company and the other a validated, opposite-typed
 * counterparty. Must never infer either side from ctx here, since this
 * function is shared by both the supplier-initiated and customer-initiated
 * creation flows.
 */
export function createShipmentRecord(data: CreateShipmentRecordInput) {
  return prisma.shipment.create({
    data: { ...data, status: ShipmentStatus.PENDING },
    include: shipmentListInclude,
  });
}

/**
 * Records the customer's pickup gate info + optional Maps link. Guards the
 * ASSIGNED requirement via the WHERE clause itself (rather than a separate
 * check-then-write) so this stays atomic against a concurrent supplier
 * "Araç Parktan Çıktı" transition racing it to HEADING_TO_PICKUP — returns
 * count 0 instead of silently writing onto a shipment that has moved on.
 */
export function markShipmentLoadReady(
  shipmentId: string,
  data: { pickupGateInfo: string; pickupMapsUrl?: string }
) {
  return prisma.shipment.updateMany({
    where: { id: shipmentId, status: ShipmentStatus.ASSIGNED },
    data: {
      pickupGateInfo: data.pickupGateInfo,
      pickupMapsUrl: data.pickupMapsUrl ?? null,
      loadReadyAt: new Date(),
    },
  });
}

/**
 * Records the supplier's pickup ETA. Re-settable (to reflect delays) any
 * time up through HEADING_TO_PICKUP — unlike markShipmentLoadReady/
 * approveShipmentPrice this isn't locked to a single status, so the WHERE
 * clause allows both statuses that precede an actual arrival rather than
 * guarding a single-status window.
 */
export function setShipmentPickupEta(
  shipmentId: string,
  supplierCompanyId: string,
  estimatedPickupArrivalAt: Date
) {
  return prisma.shipment.updateMany({
    where: {
      id: shipmentId,
      supplierCompanyId,
      status: {
        in: [ShipmentStatus.ASSIGNED, ShipmentStatus.HEADING_TO_PICKUP],
      },
    },
    data: { estimatedPickupArrivalAt },
  });
}

/**
 * Records acceptance of whichever price is currently on the table. Guards
 * the ASSIGNED + not-already-approved requirement via the WHERE clause
 * (same atomic pattern as markShipmentLoadReady) so this can't race a
 * concurrent HEADING_TO_PICKUP transition or a concurrent counter-offer.
 */
export function approveShipmentPrice(shipmentId: string) {
  return prisma.shipment.updateMany({
    where: {
      id: shipmentId,
      status: ShipmentStatus.ASSIGNED,
      priceApprovedAt: null,
    },
    data: { priceApprovedAt: new Date() },
  });
}

/**
 * Puts a new price on the table, attributed to whichever side is calling.
 * Clears priceRejectedAt (a new proposal supersedes a bare rejection) and
 * priceApprovedAt (a fresh number always needs the other side's review,
 * even if this is the same side revising their own still-pending offer).
 */
export function proposeShipmentPrice(
  ctx: TenantContext,
  shipmentId: string,
  proposedBy: CompanyType,
  amount: number
) {
  return prisma.shipment.updateMany({
    where: {
      id: shipmentId,
      ...tenantVisibilityFilter(ctx),
      status: ShipmentStatus.ASSIGNED,
      priceApprovedAt: null,
    },
    data: {
      agreedPrice: amount,
      priceProposedBy: proposedBy,
      priceRejectedAt: null,
      priceApprovedAt: null,
    },
  });
}

/** Records a bare rejection (no counter-price) of whichever price is currently on the table. */
export function rejectShipmentPrice(ctx: TenantContext, shipmentId: string) {
  return prisma.shipment.updateMany({
    where: {
      id: shipmentId,
      ...tenantVisibilityFilter(ctx),
      status: ShipmentStatus.ASSIGNED,
      priceApprovedAt: null,
    },
    data: { priceRejectedAt: new Date() },
  });
}

/**
 * The currently-open incident for a shipment, tenant-scoped the same way as
 * getShipmentForTenant. Callers should only call this when
 * shipment.hasOpenIncident is true — cheap enough either way, but avoids a
 * pointless query in the common (no open incident) case.
 */
export function getOpenShipmentIncidentForTenant(
  ctx: TenantContext,
  shipmentId: string
) {
  return prisma.shipmentIncident.findFirst({
    where: {
      shipmentId,
      resolvedAt: null,
      shipment: tenantVisibilityFilter(ctx),
    },
    include: { reportedByDriver: { select: { fullName: true } } },
    orderBy: { reportedAt: "desc" },
  });
}

/**
 * The evidence photo attached to the mandatory LOADING -> EN_ROUTE
 * departure transition. Filtered on `toStatus` (not just "most recent
 * photoUrl") since the EN_ROUTE -> COMPLETED delivery transition is now
 * also photographed (see getShipmentDeliveryPhoto below) — without this
 * filter, a completed shipment would have its delivery photo shadow the
 * departure one here. Distinct from getOpenShipmentIncidentForTenant's
 * photo, which is breakdown evidence, not a routine-transition one.
 *
 * No tenant filter of its own: StatusHistory.entityId is a raw polymorphic
 * UUID column with no real FK to Shipment (see the model comment in
 * schema.prisma), so there's no `shipment` relation to filter through here
 * the way getOpenShipmentIncidentForTenant does. Callers must only call
 * this with a shipmentId already confirmed to belong to the tenant (e.g.
 * right after a successful getShipmentForTenant on the same page).
 */
export function getShipmentDeparturePhoto(shipmentId: string) {
  return prisma.statusHistory.findFirst({
    where: {
      entityType: StatusEntityType.SHIPMENT,
      entityId: shipmentId,
      toStatus: ShipmentStatus.EN_ROUTE,
      photoUrl: { not: null },
    },
    select: { photoUrl: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * The proof-of-delivery photo attached to the mandatory
 * EN_ROUTE/AT_DELIVERY_POINT -> COMPLETED transition. Same no-tenant-filter
 * caveat as getShipmentDeparturePhoto above.
 */
export function getShipmentDeliveryPhoto(shipmentId: string) {
  return prisma.statusHistory.findFirst({
    where: {
      entityType: StatusEntityType.SHIPMENT,
      entityId: shipmentId,
      toStatus: ShipmentStatus.COMPLETED,
      photoUrl: { not: null },
    },
    select: { photoUrl: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Every SHIPMENT-entity transition this shipment has gone through, oldest
 * first — powers the step-by-step timeline on the detail page. Same
 * no-tenant-filter caveat as getShipmentDeparturePhoto: StatusHistory's
 * entityId is a polymorphic UUID with no real FK to Shipment, so callers
 * must only call this with a shipmentId already confirmed to belong to the
 * tenant (e.g. right after getShipmentForTenant on the same page).
 */
export function getShipmentStatusHistory(shipmentId: string) {
  return prisma.statusHistory.findMany({
    where: { entityType: StatusEntityType.SHIPMENT, entityId: shipmentId },
    select: { toStatus: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Public tracking lookup — NO tenant scope, by design: anyone holding a
 * tracking number can see a shipment's progress without logging in. The
 * SELECT is deliberately narrow (no price, no company, no driver/vehicle,
 * no internal id beyond what the caller needs to fetch status history) so
 * nothing commercially sensitive leaks through the public /track page.
 */
export function getShipmentByTrackingNumber(trackingNumber: number) {
  return prisma.shipment.findUnique({
    where: { trackingNumber },
    select: {
      id: true,
      trackingNumber: true,
      originAddress: true,
      destinationAddress: true,
      status: true,
      createdAt: true,
      hasOpenIncident: true,
      lastKnownLat: true,
      lastKnownLng: true,
      lastLocationAt: true,
    },
  });
}

export function countShipmentsByStatus(ctx: TenantContext) {
  return prisma.shipment.groupBy({
    by: ["status"],
    where: { supplierCompanyId: ctx.companyId },
    _count: true,
  });
}

/** Shipments completed per day over the trailing window, for the dashboard trend chart. */
export async function getCompletedShipmentsPerDay(
  ctx: TenantContext,
  sinceDate: Date
) {
  const rows = await prisma.shipment.findMany({
    where: {
      supplierCompanyId: ctx.companyId,
      status: ShipmentStatus.COMPLETED,
      completedAt: { gte: sinceDate },
    },
    select: { completedAt: true },
  });
  return rows;
}

/**
 * Most recently touched shipments for the dashboard's "Son Aktiviteler"
 * feed — a shipment's own `updatedAt`/`status` already reflects its latest
 * status transition (see advanceShipmentStatusCore in shipment-status.ts,
 * which always updates both together), so this needs no separate join
 * against StatusHistory to show real, current activity.
 */
export async function listRecentActivity(ctx: TenantContext, limit: number) {
  return prisma.shipment.findMany({
    where: { supplierCompanyId: ctx.companyId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      trackingNumber: true,
      originAddress: true,
      destinationAddress: true,
      status: true,
      updatedAt: true,
      hasOpenIncident: true,
      vehicle: { select: { plate: true } },
      driver: { select: { fullName: true } },
    },
  });
}

/**
 * The single shipment the dashboard's "featured" detail panel highlights —
 * whichever is currently most in-motion (not yet PENDING/unassigned, not
 * yet finished), most recently touched first. Falls back to the most
 * recently touched shipment of ANY status so the panel still has something
 * to show for a supplier whose whole book is either brand new or finished,
 * rather than going empty the moment nothing is mid-transit.
 */
export async function getFeaturedShipmentForSupplier(ctx: TenantContext) {
  const inMotion = await prisma.shipment.findFirst({
    where: {
      supplierCompanyId: ctx.companyId,
      status: {
        notIn: [
          ShipmentStatus.PENDING,
          ShipmentStatus.COMPLETED,
          ShipmentStatus.CANCELLED,
        ],
      },
    },
    orderBy: { updatedAt: "desc" },
    include: shipmentListInclude,
  });
  if (inMotion) return inMotion;

  return prisma.shipment.findFirst({
    where: { supplierCompanyId: ctx.companyId },
    orderBy: { updatedAt: "desc" },
    include: shipmentListInclude,
  });
}
