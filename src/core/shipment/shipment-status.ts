import { prisma } from "@/lib/db";
import type { Prisma, Shipment } from "@/generated/prisma/client";
import {
  CompanyType,
  DriverStatus,
  ShipmentStatus,
  StatusChangeSource,
  StatusEntityType,
  VehicleStatus,
} from "@/generated/prisma/client";
import { recordStatusChange } from "@/core/shared/status-history";
import {
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from "@/core/shared/errors";
import { requireCompanyType } from "@/core/shared/authorization";
import { isDriverAssignable } from "@/lib/driver-status";
import { assertDriverNotBlockedForCustomer } from "@/core/driver-block/driver-block-service";
import type { TenantContext } from "@/core/shared/tenant-context";
import type { DriverContext } from "@/core/shared/driver-context";
import type { GateGuardContext } from "@/core/shared/gate-guard-context";
import {
  SHIPMENT_ALLOWED_TRANSITIONS,
  SHIPMENT_TO_VEHICLE_STATUS,
} from "@/core/shipment/shipment-transitions";
import * as companyRepository from "@/core/company/company-repository";
import * as notificationService from "@/core/notification/notification-service";
import { dispatchShipmentStatusWebhook } from "@/core/integration/webhook-dispatch";
import { saveUploadedPhoto } from "@/lib/file-storage";

export { SHIPMENT_ALLOWED_TRANSITIONS };

function assertTransitionAllowed(from: ShipmentStatus, to: ShipmentStatus) {
  if (!SHIPMENT_ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(
      `"${from}" durumundan "${to}" durumuna geçilemez.`
    );
  }
}

/**
 * The dispatcher's single-screen match: picks an idle driver + an available
 * vehicle and assigns both to a PENDING shipment in one atomic step.
 */
export async function assignVehicleAndDriver(
  ctx: TenantContext,
  params: {
    shipmentId: string;
    vehicleId: string;
    driverId: string;
    // Optional: only the direct-request flow needs it (the supplier proposes
    // a price at assignment time). A marketplace shipment whose bid was
    // already accepted arrives here with an agreed+approved price, so the
    // supplier isn't asked again and any value passed here is ignored.
    agreedPrice?: number;
  }
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);

  const { updatedShipment, proposedAmount } = await prisma.$transaction(
    async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: params.shipmentId, supplierCompanyId: ctx.companyId },
      });
      if (!shipment) throw new NotFoundError("Sefer bulunamadı.");
      assertTransitionAllowed(shipment.status, ShipmentStatus.ASSIGNED);

      // A non-null agreedPrice at this point can only come from an accepted
      // marketplace bid (acceptBid sets agreedPrice + priceApprovedAt before
      // the winning supplier assigns) — price negotiation otherwise happens
      // only AFTER assignment. So this cleanly distinguishes "price already
      // agreed, don't touch it" from the direct-request flow where the
      // supplier proposes the price here.
      const priceAlreadyAgreed = shipment.agreedPrice !== null;
      if (
        !priceAlreadyAgreed &&
        !(typeof params.agreedPrice === "number" && params.agreedPrice > 0)
      ) {
        throw new ValidationError("Nakliye fiyatı pozitif bir değer olmalı.");
      }

      const vehicle = await tx.vehicle.findFirst({
        where: { id: params.vehicleId, companyId: ctx.companyId },
      });
      if (!vehicle) throw new NotFoundError("Araç bulunamadı.");
      if (vehicle.status !== VehicleStatus.AVAILABLE) {
        throw new ValidationError("Seçilen araç şu anda müsait değil.");
      }

      const driver = await tx.driver.findFirst({
        where: { id: params.driverId, companyId: ctx.companyId },
      });
      if (!driver) throw new NotFoundError("Şoför bulunamadı.");
      // N2/N7: müsaitlik, saklı durum + izin aralığı + deaktif durumunu kapsar.
      if (!isDriverAssignable(driver)) {
        throw new ValidationError("Seçilen şoför şu anda müsait değil.");
      }
      // Customer "kara liste": never send a driver this shipment's customer
      // has blocked (by TC or license). See src/core/driver-block.
      await assertDriverNotBlockedForCustomer(
        tx,
        shipment.customerCompanyId,
        driver
      );

      const updatedShipment = await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: ShipmentStatus.ASSIGNED,
          vehicleId: vehicle.id,
          driverId: driver.id,
          // Price already agreed (accepted bid) → leave agreedPrice,
          // priceProposedBy and priceApprovedAt exactly as the bid
          // acceptance set them. Direct flow → the supplier's fresh proposal,
          // awaiting the customer's approval.
          ...(priceAlreadyAgreed
            ? {}
            : {
                agreedPrice: params.agreedPrice,
                priceProposedBy: CompanyType.SUPPLIER,
                priceApprovedAt: null,
              }),
        },
      });
      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: { status: VehicleStatus.ASSIGNED },
      });
      await tx.driver.update({
        where: { id: driver.id },
        data: { status: DriverStatus.ON_TRIP },
      });

      await recordStatusChange(tx, {
        entityType: StatusEntityType.SHIPMENT,
        entityId: shipment.id,
        fromStatus: shipment.status,
        toStatus: ShipmentStatus.ASSIGNED,
        changedByUserId: ctx.userId,
        source: StatusChangeSource.MANUAL,
      });
      await recordStatusChange(tx, {
        entityType: StatusEntityType.VEHICLE,
        entityId: vehicle.id,
        fromStatus: vehicle.status,
        toStatus: VehicleStatus.ASSIGNED,
        changedByUserId: ctx.userId,
        source: StatusChangeSource.MANUAL,
      });
      await recordStatusChange(tx, {
        entityType: StatusEntityType.DRIVER,
        entityId: driver.id,
        fromStatus: driver.status,
        toStatus: DriverStatus.ON_TRIP,
        changedByUserId: ctx.userId,
        source: StatusChangeSource.MANUAL,
      });

      return {
        updatedShipment,
        proposedAmount: priceAlreadyAgreed ? null : params.agreedPrice!,
      };
    }
  );

  // Only the direct-request flow proposes a new price here; a bid-accepted
  // shipment's price was already agreed, so there's nothing to notify about.
  if (proposedAmount != null) {
    try {
      const supplierCompany = await companyRepository.getCompanyById(
        ctx.companyId
      );
      await notificationService.notifyPriceProposed({
        recipientCompanyId: updatedShipment.customerCompanyId,
        proposerCompanyName: supplierCompany?.name ?? "Tedarikçi",
        amount: proposedAmount,
        shipment: updatedShipment,
      });
    } catch (error) {
      console.error("Fiyat teklifi bildirimi oluşturulamadı:", error);
    }
  }

  return updatedShipment;
}

/**
 * Shared transaction body for every "move a shipment one step forward" path
 * — the dispatcher's advanceShipmentStatus and the driver's
 * advanceShipmentStatusAsDriver both call this, so the structural-transition
 * check, the price-approval guard, and the vehicle/driver side-effects can
 * never silently drift apart between the two entry points. The only thing
 * that legitimately differs per caller — how the shipment row gets found
 * and scoped/authorized — is passed in as `findShipment`.
 */
async function advanceShipmentStatusCore(params: {
  targetStatus: ShipmentStatus;
  findShipment: (tx: Prisma.TransactionClient) => Promise<Shipment | null>;
  source: StatusChangeSource;
  sourceReference?: string | null;
  changedByUserId?: string | null;
  changedByDriverId?: string | null;
  /** Only ever applied to the SHIPMENT entity's own history row, never Vehicle/Driver. */
  photoUrl?: string | null;
}): Promise<Shipment> {
  let fromStatus: ShipmentStatus | undefined;

  const updatedShipment = await prisma.$transaction(async (tx) => {
    const shipment = await params.findShipment(tx);
    if (!shipment) throw new NotFoundError("Sefer bulunamadı.");
    assertTransitionAllowed(shipment.status, params.targetStatus);
    fromStatus = shipment.status;

    // The vehicle can't be sent off to load until the customer has agreed
    // to the price proposed at assignment time — see approvePrice in
    // shipment-service.ts.
    if (
      params.targetStatus === ShipmentStatus.HEADING_TO_PICKUP &&
      !shipment.priceApprovedAt
    ) {
      throw new ValidationError("Müşteri nakliye fiyatını henüz onaylamadı.");
    }

    // G3: a shipment can only be completed once the stamped waybill (irsaliye)
    // has been uploaded by the driver AND confirmed by the supplier. Applies to
    // every completion path (driver and dispatcher alike).
    if (params.targetStatus === ShipmentStatus.COMPLETED) {
      if (!shipment.waybillPhotoUrl) {
        throw new ValidationError(
          "Teslimatı tamamlamak için önce kaşeli-imzalı irsaliye yüklenmelidir."
        );
      }
      if (!shipment.waybillConfirmedAt) {
        throw new ValidationError(
          "İrsaliye henüz nakliyeci tarafından onaylanmadı."
        );
      }
    }

    const isCompleting = params.targetStatus === ShipmentStatus.COMPLETED;

    const updatedShipment = await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: params.targetStatus,
        completedAt: isCompleting ? new Date() : undefined,
      },
    });

    await recordStatusChange(tx, {
      entityType: StatusEntityType.SHIPMENT,
      entityId: shipment.id,
      fromStatus: shipment.status,
      toStatus: params.targetStatus,
      changedByUserId: params.changedByUserId,
      changedByDriverId: params.changedByDriverId,
      source: params.source,
      sourceReference: params.sourceReference,
      photoUrl: params.photoUrl,
    });

    if (shipment.vehicleId) {
      const vehicle = await tx.vehicle.findUniqueOrThrow({
        where: { id: shipment.vehicleId },
      });
      const vehicleNextStatus = isCompleting
        ? VehicleStatus.AVAILABLE
        : SHIPMENT_TO_VEHICLE_STATUS[params.targetStatus]!;

      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: { status: vehicleNextStatus },
      });
      await recordStatusChange(tx, {
        entityType: StatusEntityType.VEHICLE,
        entityId: vehicle.id,
        fromStatus: vehicle.status,
        toStatus: vehicleNextStatus,
        changedByUserId: params.changedByUserId,
        changedByDriverId: params.changedByDriverId,
        source: params.source,
        sourceReference: params.sourceReference,
      });
    }

    if (shipment.driverId && isCompleting) {
      const driver = await tx.driver.findUniqueOrThrow({
        where: { id: shipment.driverId },
      });
      await tx.driver.update({
        where: { id: driver.id },
        data: { status: DriverStatus.AVAILABLE },
      });
      await recordStatusChange(tx, {
        entityType: StatusEntityType.DRIVER,
        entityId: driver.id,
        fromStatus: driver.status,
        toStatus: DriverStatus.AVAILABLE,
        changedByUserId: params.changedByUserId,
        changedByDriverId: params.changedByDriverId,
        source: params.source,
        sourceReference: params.sourceReference,
      });
    }

    return updatedShipment;
  });

  // Best-effort, post-commit — see dispatchShipmentStatusWebhook's own
  // doc comment. Every status-change path that goes through this shared
  // core function gets this for free; assignVehicleAndDriver's PENDING ->
  // ASSIGNED and cancelShipment's -> CANCELLED transitions run their own
  // separate transactions and deliberately don't (see the module comment
  // on webhook-dispatch.ts for the scoping rationale).
  try {
    await dispatchShipmentStatusWebhook(updatedShipment, fromStatus!, params.targetStatus);
  } catch (error) {
    console.error("Webhook gönderimi başarısız:", error);
  }

  return updatedShipment;
}

/**
 * Moves a shipment one step forward (LOADING / EN_ROUTE / AT_DELIVERY_POINT
 * / COMPLETED). Completing a shipment atomically releases its vehicle and
 * driver back to AVAILABLE in the same transaction — this is what makes
 * "teslimat bittiğinde araç otomatik müsaite döner" hold true.
 *
 * `source`/`sourceReference` default to a manual dispatcher action; Phase 6's
 * webhook layer will call this same function with `EXTERNAL_WEBHOOK` and the
 * originating event id once external GPS/ERP integration is built.
 */
export async function advanceShipmentStatus(
  ctx: TenantContext,
  params: { shipmentId: string; targetStatus: ShipmentStatus },
  source: StatusChangeSource = StatusChangeSource.MANUAL,
  sourceReference?: string
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);

  // PENDING -> ASSIGNED requires picking a vehicle + driver, which this
  // generic advance never collects. assignVehicleAndDriver is the only
  // valid path to ASSIGNED — block it here unconditionally so a shipment can
  // never end up ASSIGNED (or, by extension, COMPLETED) with no vehicle or
  // driver attached, regardless of which UI surface calls this.
  if (params.targetStatus === ShipmentStatus.ASSIGNED) {
    throw new InvalidTransitionError(
      "Sefer ataması Atama ekranından yapılmalıdır."
    );
  }

  const updatedShipment = await advanceShipmentStatusCore({
    targetStatus: params.targetStatus,
    findShipment: (tx) =>
      tx.shipment.findFirst({
        where: { id: params.shipmentId, supplierCompanyId: ctx.companyId },
      }),
    source,
    sourceReference,
    changedByUserId: source === StatusChangeSource.MANUAL ? ctx.userId : null,
  });

  // Best-effort: a notification failure must never fail a status transition
  // that has already committed. Fetched post-commit (not inside the
  // transaction) since it's a read of unrelated data, not part of the
  // atomic write.
  if (params.targetStatus === ShipmentStatus.HEADING_TO_PICKUP) {
    try {
      const supplierCompany = await companyRepository.getCompanyById(
        ctx.companyId
      );
      await notificationService.notifyVehicleDeparted({
        customerCompanyId: updatedShipment.customerCompanyId,
        supplierCompanyName: supplierCompany?.name ?? "Tedarikçi",
        shipment: updatedShipment,
      });
    } catch (error) {
      console.error("Araç yola çıktı bildirimi oluşturulamadı:", error);
    }
  }

  // Same best-effort rationale as above. Without this, a shipment completed
  // through the dispatcher's own override (rather than the driver's own
  // COMPLETED report, which already notifies via
  // DRIVER_NOTIFY_BY_STATUS/notifyDriverCompletedDelivery below) would
  // silently never tell the customer their delivery is done — including
  // never sending the "teslimat tamamlandı" email hooked into that same
  // notification function.
  if (params.targetStatus === ShipmentStatus.COMPLETED) {
    try {
      const [supplierCompany, driver] = await Promise.all([
        companyRepository.getCompanyById(ctx.companyId),
        updatedShipment.driverId
          ? prisma.driver.findUnique({
              where: { id: updatedShipment.driverId },
              select: { fullName: true },
            })
          : null,
      ]);
      await notificationService.notifyDriverCompletedDelivery({
        customerCompanyId: updatedShipment.customerCompanyId,
        customerCompanyName: "Müşteri",
        supplierCompanyId: ctx.companyId,
        supplierCompanyName: supplierCompany?.name ?? "Tedarikçi",
        driverName: driver?.fullName ?? "Şoför",
        shipment: updatedShipment,
      });
    } catch (error) {
      console.error("Teslimat tamamlandı bildirimi oluşturulamadı:", error);
    }
  }

  return updatedShipment;
}

/**
 * The steps a driver can report themselves from their own scoped view.
 * Deliberately excludes ASSIGNED (needs a vehicle+driver pick, dispatcher
 * only) and CANCELLED (a dispatcher-level business decision).
 *
 * HEADING_TO_PICKUP is included (N6): once the customer marks the cargo ready
 * ("yük hazır") AND the price is approved, the driver gets the green light to
 * head to the pickup themselves, rather than waiting on the dispatcher to push
 * them off. Both gates still hold — the price-approval check lives in
 * advanceShipmentStatusCore, the load-ready check is enforced below before the
 * transition runs — so this never lets a driver leave prematurely.
 */
const DRIVER_ALLOWED_TARGET_STATUSES: ReadonlySet<ShipmentStatus> = new Set([
  ShipmentStatus.HEADING_TO_PICKUP,
  ShipmentStatus.LOADING,
  ShipmentStatus.AT_PICKUP_GATE,
  ShipmentStatus.EN_ROUTE,
  ShipmentStatus.AT_DELIVERY_POINT,
  ShipmentStatus.COMPLETED,
]);

const DRIVER_NOTIFY_BY_STATUS: Partial<
  Record<
    ShipmentStatus,
    (params: {
      customerCompanyId: string;
      customerCompanyName: string;
      supplierCompanyId: string;
      supplierCompanyName: string;
      driverName: string;
      shipment: Shipment;
    }) => Promise<unknown>
  >
> = {
  [ShipmentStatus.LOADING]: notificationService.notifyDriverArrivedPickup,
  [ShipmentStatus.AT_PICKUP_GATE]: notificationService.notifyDriverAtPickupGate,
  [ShipmentStatus.EN_ROUTE]: notificationService.notifyDriverDepartedPickup,
  [ShipmentStatus.AT_DELIVERY_POINT]:
    notificationService.notifyDriverArrivedDelivery,
  [ShipmentStatus.COMPLETED]: notificationService.notifyDriverCompletedDelivery,
};

/**
 * A driver reports progress on their own currently-assigned shipment. The
 * `findShipment` scope (`driverId: driverCtx.driverId`) doubles as the
 * ownership check — a driver can never touch a shipment that isn't theirs,
 * and "doesn't exist" vs "isn't yours" both collapse to the same
 * NotFoundError (no ID-enumeration signal). This is provably sufficient
 * without a redundant companyId check: assignVehicleAndDriver only ever
 * sets shipment.driverId to a Driver row it already scoped to its own
 * supplierCompanyId, so driverId match structurally implies company match.
 *
 * `note` is optional free text the driver can attach (e.g. "kapıda 20 dk
 * bekledim") — reuses StatusHistory.sourceReference, which otherwise only
 * ever carries a webhook event id, since both are "context about how this
 * change happened" in spirit and this avoids a schema-only-for-this field.
 *
 * `photo` is mandatory for two transitions — EN_ROUTE (leaving the pickup
 * point after loading — proof of departure) and COMPLETED (proof of
 * delivery, POD) — enforced here, NOT in the UI alone: an `<input
 * required>` only stops a well-behaved browser, and a Server Action is
 * directly reachable via a forged POST regardless of what the bound form
 * renders. This guarantee only covers this driver-specific entry point —
 * the dispatcher's own advanceShipmentStatus can still drive a shipment
 * through either transition unphotographed via their own override screen,
 * exactly as it already bypasses the note field today.
 */
// Only the departure leg forces an inline photo now. COMPLETED's proof is the
// stamped waybill (irsaliye) uploaded earlier at the delivery point and
// confirmed by the supplier (G3) — gated in advanceShipmentStatusCore, not
// here, so it applies to the dispatcher's completion too.
const PHOTO_REQUIRED_TARGET_STATUSES: ReadonlySet<ShipmentStatus> = new Set([
  ShipmentStatus.EN_ROUTE,
]);

export async function advanceShipmentStatusAsDriver(
  driverCtx: DriverContext,
  params: {
    shipmentId: string;
    targetStatus: ShipmentStatus;
    note?: string;
    photo?: File;
  }
) {
  if (!DRIVER_ALLOWED_TARGET_STATUSES.has(params.targetStatus)) {
    throw new InvalidTransitionError("Şoförler bu durum değişikliğini yapamaz.");
  }

  // N6: a driver may only start heading once the customer has confirmed the
  // cargo is ready. Checked here (the driver entry point) rather than in the
  // shared core — the dispatcher's own HEADING_TO_PICKUP push is unaffected.
  // The price-approval gate is enforced for both paths inside the core.
  if (params.targetStatus === ShipmentStatus.HEADING_TO_PICKUP) {
    const ready = await prisma.shipment.findFirst({
      where: { id: params.shipmentId, driverId: driverCtx.driverId },
      select: { loadReadyAt: true },
    });
    if (!ready) throw new NotFoundError("Sefer bulunamadı.");
    if (!ready.loadReadyAt) {
      throw new ValidationError(
        "Müşteri henüz yükün hazır olduğunu bildirmedi. Lütfen bekleyin."
      );
    }
  }

  const hasRealPhoto = params.photo instanceof File && params.photo.size > 0;
  if (PHOTO_REQUIRED_TARGET_STATUSES.has(params.targetStatus) && !hasRealPhoto) {
    throw new ValidationError(
      "Yükleme noktasından çıkarken bir fotoğraf eklemeniz zorunludur."
    );
  }

  let photoUrl: string | undefined;
  if (hasRealPhoto) {
    // Ownership confirmed BEFORE any disk I/O — a forged/unauthorized
    // shipmentId never causes a directory to be created. Uses this row's
    // own confirmed id, not the raw params.shipmentId, for the same reason.
    const owned = await prisma.shipment.findFirst({
      where: { id: params.shipmentId, driverId: driverCtx.driverId },
      select: { id: true },
    });
    if (!owned) throw new NotFoundError("Sefer bulunamadı.");
    photoUrl = await saveUploadedPhoto(params.photo!, owned.id);
  }

  const updatedShipment = await advanceShipmentStatusCore({
    targetStatus: params.targetStatus,
    findShipment: (tx) =>
      tx.shipment.findFirst({
        where: { id: params.shipmentId, driverId: driverCtx.driverId },
      }),
    source: StatusChangeSource.DRIVER,
    sourceReference: params.note,
    changedByDriverId: driverCtx.driverId,
    photoUrl,
  });

  // N6: a driver-initiated departure tells the customer their vehicle is on
  // its way, same as the dispatcher's own HEADING_TO_PICKUP push does. Kept
  // separate from DRIVER_NOTIFY_BY_STATUS because notifyVehicleDeparted has a
  // different signature (no driver/customer-name fields).
  if (params.targetStatus === ShipmentStatus.HEADING_TO_PICKUP) {
    try {
      const supplierCompany = updatedShipment.supplierCompanyId
        ? await companyRepository.getCompanyById(updatedShipment.supplierCompanyId)
        : null;
      await notificationService.notifyVehicleDeparted({
        customerCompanyId: updatedShipment.customerCompanyId,
        supplierCompanyName: supplierCompany?.name ?? "Tedarikçi",
        shipment: updatedShipment,
      });
    } catch (error) {
      console.error("Araç yola çıktı bildirimi oluşturulamadı:", error);
    }
  }

  const notify = DRIVER_NOTIFY_BY_STATUS[params.targetStatus];
  if (notify) {
    try {
      const [customerCompany, supplierCompany] = await Promise.all([
        companyRepository.getCompanyById(updatedShipment.customerCompanyId),
        updatedShipment.supplierCompanyId
          ? companyRepository.getCompanyById(updatedShipment.supplierCompanyId)
          : null,
      ]);
      await notify({
        customerCompanyId: updatedShipment.customerCompanyId,
        customerCompanyName: customerCompany?.name ?? "Müşteri",
        supplierCompanyId: driverCtx.companyId,
        supplierCompanyName: supplierCompany?.name ?? "Tedarikçi",
        driverName: driverCtx.fullName,
        shipment: updatedShipment,
      });
    } catch (error) {
      console.error("Şoför bildirimi oluşturulamadı:", error);
    }
  }

  return updatedShipment;
}

/**
 * G3: the driver uploads the stamped & signed waybill (irsaliye) once at the
 * delivery point. Stored on the shipment (not as a status-history photo) since
 * the supplier must then confirm it before the shipment can complete.
 * Re-uploading replaces the photo and clears any prior confirmation, so an
 * amended document is always re-approved. Ownership scoping mirrors
 * advanceShipmentStatusAsDriver.
 */
export async function uploadWaybillAsDriver(
  driverCtx: DriverContext,
  params: { shipmentId: string; photo?: File }
) {
  const hasRealPhoto = params.photo instanceof File && params.photo.size > 0;
  if (!hasRealPhoto) {
    throw new ValidationError(
      "Lütfen kaşeli-imzalı irsaliyenin fotoğrafını ekleyin."
    );
  }
  const owned = await prisma.shipment.findFirst({
    where: { id: params.shipmentId, driverId: driverCtx.driverId },
    select: { id: true, status: true },
  });
  if (!owned) throw new NotFoundError("Sefer bulunamadı.");
  if (owned.status !== ShipmentStatus.AT_DELIVERY_POINT) {
    throw new ValidationError(
      "İrsaliye yalnızca teslimat noktasına varıldığında yüklenebilir."
    );
  }
  const photoUrl = await saveUploadedPhoto(params.photo!, owned.id);
  await prisma.shipment.update({
    where: { id: owned.id },
    data: {
      waybillPhotoUrl: photoUrl,
      waybillConfirmedAt: null,
      waybillConfirmedByUserId: null,
    },
  });
  return { waybillPhotoUrl: photoUrl };
}

/**
 * Restricted to the two "vehicle is actually moving between two points"
 * legs — HEADING_TO_PICKUP (towards the customer) and EN_ROUTE (towards the
 * delivery point). While LOADING/AT_PICKUP_GATE/AT_DELIVERY_POINT the
 * vehicle is stationary at a gate/dock, so there is nothing live to show;
 * excluding those keeps a stale-but-technically-recent pin from ever
 * appearing next to a truck that hasn't moved. No StatusHistory row (this
 * isn't a status transition), no notification — purely informational,
 * overwrites in place, same "no history, just current state" shape as
 * dock reservation status. Ownership scoping mirrors
 * advanceShipmentStatusAsDriver: `driverId` match is sufficient (see that
 * function's own doc comment for why).
 */
const LOCATION_UPDATE_ALLOWED_STATUSES: ReadonlySet<ShipmentStatus> = new Set([
  ShipmentStatus.HEADING_TO_PICKUP,
  ShipmentStatus.EN_ROUTE,
]);

export async function updateShipmentLocation(
  driverCtx: DriverContext,
  params: { shipmentId: string; lat: number; lng: number }
) {
  const result = await prisma.shipment.updateMany({
    where: {
      id: params.shipmentId,
      driverId: driverCtx.driverId,
      status: { in: Array.from(LOCATION_UPDATE_ALLOWED_STATUSES) },
    },
    data: {
      lastKnownLat: params.lat,
      lastKnownLng: params.lng,
      lastLocationAt: new Date(),
    },
  });
  if (result.count === 0) {
    throw new NotFoundError(
      "Sefer bulunamadı veya konum güncellemesi için uygun durumda değil."
    );
  }
}

/**
 * The only two steps a dock reservation event can ever drive (see
 * dock-reservation-status.ts): the gate guard's own facility only accounts
 * for the customer's pickup dock, never the destination or completion —
 * jumping straight to AT_DELIVERY_POINT/COMPLETED from here would be
 * physically impossible for them to actually know.
 */
const GATE_GUARD_ALLOWED_TARGET_STATUSES: ReadonlySet<ShipmentStatus> = new Set([
  ShipmentStatus.LOADING,
  ShipmentStatus.AT_PICKUP_GATE,
]);

/**
 * Best-effort caller from dock-reservation-status.ts: a gate guard marking
 * a linked dock reservation's "Araç Geldi"/"Tamamlandı" advances the
 * shipment the same way a driver's own report would (LOADING/AT_PICKUP_GATE),
 * scoped to the gate guard's own (CUSTOMER) company via customerCompanyId —
 * same ownership-doubles-as-scope reasoning as advanceShipmentStatusAsDriver.
 * `reservationId` is threaded through as sourceReference purely for
 * StatusHistory traceability, same spirit as the driver's own `note`.
 */
export async function advanceShipmentStatusAsGateGuard(
  gateGuardCtx: GateGuardContext,
  params: { shipmentId: string; targetStatus: ShipmentStatus; reservationId: string }
) {
  if (!GATE_GUARD_ALLOWED_TARGET_STATUSES.has(params.targetStatus)) {
    throw new InvalidTransitionError("Nizamiye bu durum değişikliğini yapamaz.");
  }

  const updatedShipment = await advanceShipmentStatusCore({
    targetStatus: params.targetStatus,
    findShipment: (tx) =>
      tx.shipment.findFirst({
        where: { id: params.shipmentId, customerCompanyId: gateGuardCtx.companyId },
      }),
    source: StatusChangeSource.GATE_GUARD,
    sourceReference: params.reservationId,
  });

  const notify = DRIVER_NOTIFY_BY_STATUS[params.targetStatus];
  if (notify) {
    try {
      const [customerCompany, supplierCompany, driver] = await Promise.all([
        companyRepository.getCompanyById(updatedShipment.customerCompanyId),
        updatedShipment.supplierCompanyId
          ? companyRepository.getCompanyById(updatedShipment.supplierCompanyId)
          : null,
        updatedShipment.driverId
          ? prisma.driver.findUnique({
              where: { id: updatedShipment.driverId },
              select: { fullName: true },
            })
          : null,
      ]);
      await notify({
        customerCompanyId: updatedShipment.customerCompanyId,
        customerCompanyName: customerCompany?.name ?? "Müşteri",
        // Guaranteed non-null: reaching LOADING/AT_PICKUP_GATE requires
        // having already passed through ASSIGNED, which only ever sets
        // supplierCompanyId (see assignVehicleAndDriver above).
        supplierCompanyId: updatedShipment.supplierCompanyId!,
        supplierCompanyName: supplierCompany?.name ?? "Tedarikçi",
        driverName: driver?.fullName ?? "Şoför",
        shipment: updatedShipment,
      });
    } catch (error) {
      console.error("Nizamiye rampa bildirimi oluşturulamadı:", error);
    }
  }

  return updatedShipment;
}

/** Cancels a shipment from any non-terminal status, releasing its vehicle/driver. */
export async function cancelShipment(ctx: TenantContext, shipmentId: string) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);

  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findFirst({
      where: { id: shipmentId, supplierCompanyId: ctx.companyId },
    });
    if (!shipment) throw new NotFoundError("Sefer bulunamadı.");
    assertTransitionAllowed(shipment.status, ShipmentStatus.CANCELLED);

    const updatedShipment = await tx.shipment.update({
      where: { id: shipment.id },
      data: { status: ShipmentStatus.CANCELLED, cancelledAt: new Date() },
    });
    await recordStatusChange(tx, {
      entityType: StatusEntityType.SHIPMENT,
      entityId: shipment.id,
      fromStatus: shipment.status,
      toStatus: ShipmentStatus.CANCELLED,
      changedByUserId: ctx.userId,
      source: StatusChangeSource.MANUAL,
    });

    if (shipment.vehicleId) {
      const vehicle = await tx.vehicle.findUniqueOrThrow({
        where: { id: shipment.vehicleId },
      });
      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: { status: VehicleStatus.AVAILABLE },
      });
      await recordStatusChange(tx, {
        entityType: StatusEntityType.VEHICLE,
        entityId: vehicle.id,
        fromStatus: vehicle.status,
        toStatus: VehicleStatus.AVAILABLE,
        changedByUserId: ctx.userId,
        source: StatusChangeSource.MANUAL,
      });
    }

    if (shipment.driverId) {
      const driver = await tx.driver.findUniqueOrThrow({
        where: { id: shipment.driverId },
      });
      await tx.driver.update({
        where: { id: driver.id },
        data: { status: DriverStatus.AVAILABLE },
      });
      await recordStatusChange(tx, {
        entityType: StatusEntityType.DRIVER,
        entityId: driver.id,
        fromStatus: driver.status,
        toStatus: DriverStatus.AVAILABLE,
        changedByUserId: ctx.userId,
        source: StatusChangeSource.MANUAL,
      });
    }

    return updatedShipment;
  });
}
