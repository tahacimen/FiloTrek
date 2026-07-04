import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { CompanyType } from "@/generated/prisma/client";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import type { DriverContext } from "@/core/shared/driver-context";
import { saveUploadedPhoto } from "@/lib/file-storage";
import * as companyRepository from "@/core/company/company-repository";
import * as notificationService from "@/core/notification/notification-service";

type IncidentShipmentRef = {
  id: string;
  customerCompanyId: string;
  supplierCompanyId: string | null;
  originAddress: string;
  destinationAddress: string;
};

const INCIDENT_SHIPMENT_SELECT = {
  id: true,
  customerCompanyId: true,
  supplierCompanyId: true,
  originAddress: true,
  destinationAddress: true,
} as const;

/**
 * Best-effort, post-commit — a notification failure must never fail the
 * report/resolve itself. `actorName` is whoever the message should credit:
 * the reporting driver for a report, or whoever resolved it (driver or
 * dispatcher) for a resolution.
 */
async function notifyIncidentBothSides(
  notify: typeof notificationService.notifyIncidentReported,
  shipment: IncidentShipmentRef,
  actorName: string
) {
  if (!shipment.supplierCompanyId) return;
  try {
    const [customerCompany, supplierCompany] = await Promise.all([
      companyRepository.getCompanyById(shipment.customerCompanyId),
      companyRepository.getCompanyById(shipment.supplierCompanyId),
    ]);
    await notify({
      customerCompanyId: shipment.customerCompanyId,
      customerCompanyName: customerCompany?.name ?? "Müşteri",
      supplierCompanyId: shipment.supplierCompanyId,
      supplierCompanyName: supplierCompany?.name ?? "Tedarikçi",
      actorName,
      shipment,
    });
  } catch (error) {
    console.error("Arıza bildirimi oluşturulamadı:", error);
  }
}

/**
 * A driver reports a breakdown on their own currently-assigned shipment.
 * `driverId: driverCtx.driverId` in the scoping query doubles as the
 * ownership check, same pattern as advanceShipmentStatusAsDriver.
 *
 * Deliberately does NOT touch shipment.status, or Vehicle/Driver status —
 * a breakdown doesn't change what stage the shipment is at (see the
 * ShipmentIncident model comment in schema.prisma). hasOpenIncident is the
 * only thing that changes on the Shipment row.
 */
export async function reportShipmentIncident(
  driverCtx: DriverContext,
  params: { shipmentId: string; note?: string; photo?: File }
) {
  const shipment = await prisma.shipment.findFirst({
    where: { id: params.shipmentId, driverId: driverCtx.driverId },
    select: { ...INCIDENT_SHIPMENT_SELECT, hasOpenIncident: true },
  });
  if (!shipment) throw new NotFoundError("Sefer bulunamadı.");
  if (shipment.hasOpenIncident) {
    throw new ValidationError("Bu seferde zaten açık bir arıza kaydı var.");
  }

  // An <input type="file"> left empty submits as an empty (size 0, type "")
  // File, never null — a plain `params.photo ? ...` check is truthy for
  // that empty File and would wrongly try to save it (see the same
  // instanceof+size guard in advanceShipmentStatusAsDriver).
  const hasRealPhoto = params.photo instanceof File && params.photo.size > 0;

  // Disk write happens only after ownership is confirmed above (no I/O for
  // a forged/unauthorized shipmentId), and before the transaction — the
  // transaction needs the resulting path to write atomically with the
  // ShipmentIncident row. An orphaned file if the transaction then fails is
  // an acceptable trade-off (harmless wasted disk space).
  const photoUrl = hasRealPhoto
    ? await saveUploadedPhoto(params.photo!, shipment.id)
    : null;

  const incident = await prisma.$transaction(async (tx) => {
    // Atomic guard against two concurrent reports racing each other — same
    // updateMany + count pattern as markShipmentLoadReady/approveShipmentPrice
    // in shipment-repository.ts, not a separate read-then-write.
    const flip = await tx.shipment.updateMany({
      where: { id: shipment.id, hasOpenIncident: false },
      data: { hasOpenIncident: true },
    });
    if (flip.count === 0) {
      throw new ValidationError("Bu seferde zaten açık bir arıza kaydı var.");
    }
    return tx.shipmentIncident.create({
      data: {
        shipmentId: shipment.id,
        reportedByDriverId: driverCtx.driverId,
        note: params.note ?? null,
        photoUrl,
      },
    });
  });

  await notifyIncidentBothSides(
    notificationService.notifyIncidentReported,
    shipment,
    driverCtx.fullName
  );

  return incident;
}

/**
 * Shared transaction body for resolving whichever incident is currently
 * open on a shipment — the driver's self-resolve and the dispatcher's
 * override both call this, mirroring advanceShipmentStatusCore's shape.
 * `findShipment` is the only thing that legitimately differs per caller.
 */
async function resolveShipmentIncidentCore(params: {
  findShipment: (
    tx: Prisma.TransactionClient
  ) => Promise<IncidentShipmentRef | null>;
  resolutionNote?: string;
  resolvedByDriverId?: string;
  resolvedByUserId?: string;
}) {
  const { shipment, incident } = await prisma.$transaction(async (tx) => {
    const shipment = await params.findShipment(tx);
    if (!shipment) throw new NotFoundError("Sefer bulunamadı.");

    const openIncident = await tx.shipmentIncident.findFirst({
      where: { shipmentId: shipment.id, resolvedAt: null },
      orderBy: { reportedAt: "asc" },
    });
    if (!openIncident) {
      throw new ValidationError("Bu seferde açık bir arıza kaydı yok.");
    }

    // Same race-safe updateMany + count guard as reportShipmentIncident.
    const flip = await tx.shipment.updateMany({
      where: { id: shipment.id, hasOpenIncident: true },
      data: { hasOpenIncident: false },
    });
    if (flip.count === 0) {
      throw new ValidationError("Bu seferde açık bir arıza kaydı yok.");
    }

    const resolvedIncident = await tx.shipmentIncident.update({
      where: { id: openIncident.id },
      data: {
        resolvedAt: new Date(),
        resolvedByDriverId: params.resolvedByDriverId ?? null,
        resolvedByUserId: params.resolvedByUserId ?? null,
        resolutionNote: params.resolutionNote ?? null,
      },
    });

    return { shipment, incident: resolvedIncident };
  });

  const resolverName =
    params.resolvedByDriverId !== undefined ? "Şoför" : "Tedarikçi";
  await notifyIncidentBothSides(
    notificationService.notifyIncidentResolved,
    shipment,
    resolverName
  );

  return incident;
}

export async function resolveShipmentIncidentAsDriver(
  driverCtx: DriverContext,
  params: { shipmentId: string; resolutionNote?: string }
) {
  return resolveShipmentIncidentCore({
    findShipment: (tx) =>
      tx.shipment.findFirst({
        where: { id: params.shipmentId, driverId: driverCtx.driverId },
        select: INCIDENT_SHIPMENT_SELECT,
      }),
    resolutionNote: params.resolutionNote,
    resolvedByDriverId: driverCtx.driverId,
  });
}

/**
 * Dispatcher-side override — restricted to SUPPLIER, matching every other
 * operational-override action in this app (advanceShipmentStatus,
 * cancelShipment, setVehicleMaintenance). The customer side only ever sees
 * the incident read-only.
 */
export async function resolveShipmentIncidentAsDispatcher(
  ctx: TenantContext,
  params: { shipmentId: string; resolutionNote?: string }
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  return resolveShipmentIncidentCore({
    findShipment: (tx) =>
      tx.shipment.findFirst({
        where: { id: params.shipmentId, supplierCompanyId: ctx.companyId },
        select: INCIDENT_SHIPMENT_SELECT,
      }),
    resolutionNote: params.resolutionNote,
    resolvedByUserId: ctx.userId,
  });
}
