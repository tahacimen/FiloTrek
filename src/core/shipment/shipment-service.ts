import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import type { DriverContext } from "@/core/shared/driver-context";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import * as shipmentRepository from "@/core/shipment/shipment-repository";
import * as companyRepository from "@/core/company/company-repository";
import * as driverRepository from "@/core/driver/driver-repository";
import * as notificationService from "@/core/notification/notification-service";
import {
  loadReadyInputSchema,
  pickupEtaInputSchema,
  priceProposalInputSchema,
  priceRejectionInputSchema,
  shipmentInputSchema,
  shipmentRequestInputSchema,
} from "@/lib/validation/shipment";
import {
  CompanyStatus,
  CompanyType,
  ShipmentStatus,
} from "@/generated/prisma/client";

export async function listShipments(ctx: TenantContext) {
  return shipmentRepository.listShipmentsForTenant(ctx);
}

/** Picker source for linking a dock reservation to one of the customer's own shipments — see dock-reservation-service.ts. */
export async function listAssignableShipmentsForDockReservation(
  ctx: TenantContext
) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  return shipmentRepository.listAssignableShipmentsForDockReservation(ctx);
}

/** No requireCompanyType-style guard needed — DriverContext is only ever obtainable via requireDriverContext(). */
export async function listActiveShipmentsForDriver(driverCtx: DriverContext) {
  return shipmentRepository.listActiveShipmentsForDriver(driverCtx.driverId);
}

export async function getShipment(ctx: TenantContext, shipmentId: string) {
  const shipment = await shipmentRepository.getShipmentForTenant(
    ctx,
    shipmentId
  );
  if (!shipment) throw new NotFoundError("Sefer bulunamadı.");
  return shipment;
}

/** Callers should only call this when shipment.hasOpenIncident is true. */
export async function getOpenIncident(ctx: TenantContext, shipmentId: string) {
  return shipmentRepository.getOpenShipmentIncidentForTenant(ctx, shipmentId);
}

/**
 * Only call this with a shipmentId already confirmed to belong to the
 * caller's tenant — see the no-tenant-filter note on
 * getShipmentDeparturePhoto in shipment-repository.ts.
 */
export async function getDeparturePhoto(shipmentId: string) {
  return shipmentRepository.getShipmentDeparturePhoto(shipmentId);
}

/** Same no-tenant-filter caveat as getDeparturePhoto above. */
export async function getDeliveryPhoto(shipmentId: string) {
  return shipmentRepository.getShipmentDeliveryPhoto(shipmentId);
}

/** Same no-tenant-filter caveat as getDeparturePhoto above. */
export async function getStatusHistory(shipmentId: string) {
  return shipmentRepository.getShipmentStatusHistory(shipmentId);
}

async function resolveCounterparty(
  companyId: string,
  expectedType: CompanyType,
  errorMessage: string
) {
  const company = await companyRepository.getCompanyById(companyId);
  if (
    !company ||
    company.type !== expectedType ||
    company.status !== CompanyStatus.ACTIVE
  ) {
    throw new ValidationError(errorMessage);
  }
  return company;
}

/** Supplier dispatcher creates a shipment, picking an existing customer. */
export async function createShipment(ctx: TenantContext, rawInput: unknown) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const input = shipmentInputSchema.parse(rawInput);

  const customer = await resolveCounterparty(
    input.customerCompanyId,
    CompanyType.CUSTOMER,
    "Geçersiz müşteri firma seçimi."
  );

  return shipmentRepository.createShipmentRecord({
    ...input,
    customerCompanyId: customer.id,
    supplierCompanyId: ctx.companyId,
  });
}

/**
 * Customer requests a vehicle ("Araç Çağır"), either picking one specific
 * supplier (notified directly, as before) or leaving `supplierCompanyId`
 * unset to open the shipment to the marketplace (see
 * marketplace-service.ts) — any supplier can then bid on it, and no one
 * gets a targeted notification since there's no specific recipient yet.
 * Symmetric to createShipment above. Notifies the chosen supplier as a
 * best-effort side effect — a notification failure must never fail the
 * shipment request itself (the shipment is the source of truth; a retry
 * after a false failure would create a duplicate request).
 */
export async function createShipmentRequest(
  ctx: TenantContext,
  rawInput: unknown
) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const input = shipmentRequestInputSchema.parse(rawInput);

  const supplier = input.supplierCompanyId
    ? await resolveCounterparty(
        input.supplierCompanyId,
        CompanyType.SUPPLIER,
        "Geçersiz tedarikçi firma seçimi."
      )
    : null;

  const shipment = await shipmentRepository.createShipmentRecord({
    ...input,
    customerCompanyId: ctx.companyId,
    supplierCompanyId: supplier?.id ?? null,
  });

  if (!supplier) return shipment;

  try {
    const customerCompany = await companyRepository.getCompanyById(
      ctx.companyId
    );
    await notificationService.notifyShipmentRequested({
      supplierCompanyId: supplier.id,
      customerCompanyName: customerCompany?.name ?? "Bir müşteri",
      shipment,
    });
  } catch (error) {
    console.error("Sefer talebi bildirimi oluşturulamadı:", error);
  }

  return shipment;
}

/**
 * Customer confirms cargo is ready to load ("Yük Hazır, Aracı Gönder"),
 * providing the exact gate/ramp info and (optionally) a Google Maps link.
 * Re-submittable while still ASSIGNED — a mistyped link would otherwise need
 * a phone call to fix, defeating the point of this feature — so this
 * overwrites rather than locks after the first call. Notifies the supplier
 * as a best-effort side effect, same rationale as createShipmentRequest.
 */
export async function markLoadReady(
  ctx: TenantContext,
  shipmentId: string,
  rawInput: unknown
) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const input = loadReadyInputSchema.parse(rawInput);

  const shipment = await shipmentRepository.getShipmentOwnedByCustomer(
    ctx,
    shipmentId
  );
  if (!shipment) throw new NotFoundError("Sefer bulunamadı.");
  if (shipment.status !== ShipmentStatus.ASSIGNED) {
    throw new ValidationError(
      "Yük hazır bildirimi yalnızca araç atandıktan sonra ve araç yola çıkmadan önce gönderilebilir."
    );
  }

  const result = await shipmentRepository.markShipmentLoadReady(
    shipmentId,
    input
  );
  if (result.count === 0) {
    // Lost the race against a concurrent status change (e.g. the supplier
    // just clicked "Araç Parktan Çıktı") between the check above and here.
    throw new ValidationError(
      "Yük hazır bildirimi yalnızca araç atandıktan sonra ve araç yola çıkmadan önce gönderilebilir."
    );
  }

  const updated = await shipmentRepository.getShipmentOwnedByCustomer(
    ctx,
    shipmentId
  );
  if (!updated) throw new NotFoundError("Sefer bulunamadı.");

  try {
    await notificationService.notifyLoadReady({
      // ASSIGNED is only reachable via assignVehicleAndDriver, which always
      // scopes the shipment to the acting supplier's own companyId — so a
      // shipment confirmed ASSIGNED above is guaranteed to have one.
      supplierCompanyId: updated.supplierCompanyId!,
      customerCompanyName: updated.customerCompany.name,
      shipment: updated,
    });
  } catch (error) {
    console.error("Yük hazır bildirimi oluşturulamadı:", error);
  }

  try {
    // Same ASSIGNED-only-reachable-via-assignVehicleAndDriver guarantee as
    // supplierCompanyId above — driverId is always set here too.
    const driver = await driverRepository.getDriverContactById(
      updated.driverId!
    );
    await notificationService.notifyDriverLoadReady({
      driverEmail: driver?.email ?? null,
      driverFullName: driver?.fullName ?? "Şoför",
      shipment: updated,
    });
  } catch (error) {
    console.error("Şoföre yükleme bildirimi e-postası gönderilemedi:", error);
  }

  return updated;
}

/**
 * Supplier sets/updates their own estimate of when the vehicle will reach
 * the pickup point. No notification hook — this is informational, plainly
 * visible on the shipment detail page to whichever side is looking, not a
 * "needs attention now" event like the three email-hooked notifications.
 */
export async function setPickupEta(
  ctx: TenantContext,
  shipmentId: string,
  rawInput: unknown
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const input = pickupEtaInputSchema.parse(rawInput);

  const result = await shipmentRepository.setShipmentPickupEta(
    shipmentId,
    ctx.companyId,
    input.estimatedPickupArrivalAt
  );
  if (result.count === 0) {
    throw new ValidationError(
      "Tahmini varış saati yalnızca araç atandıktan sonra ve yükleme noktasına varmadan önce girilebilir."
    );
  }

  return shipmentRepository.getShipmentForTenant(ctx, shipmentId);
}

/**
 * Accepts whichever price is currently on the table ("uygundur") — usable
 * by either side, but never by whoever put that price there themselves
 * (see the priceProposedBy check below). Idempotent on a second call once
 * already approved (avoids a scary error on a double click) rather than
 * re-throwing or re-notifying. Restricted to ASSIGNED, same rationale and
 * atomic guard as markLoadReady — approving after the vehicle has already
 * departed wouldn't serve the gate this exists for (see the
 * HEADING_TO_PICKUP guard in shipment-status.ts).
 */
export async function approvePrice(ctx: TenantContext, shipmentId: string) {
  const shipment = await shipmentRepository.getShipmentForTenant(
    ctx,
    shipmentId
  );
  if (!shipment) throw new NotFoundError("Sefer bulunamadı.");
  if (shipment.agreedPrice === null) {
    throw new ValidationError("Onaylanacak bir nakliye fiyatı bulunmuyor.");
  }
  if (shipment.priceApprovedAt) return shipment;
  if (shipment.priceProposedBy === ctx.companyType) {
    throw new ValidationError(
      "Kendi teklif ettiğiniz fiyatı onaylayamazsınız."
    );
  }
  if (shipment.status !== ShipmentStatus.ASSIGNED) {
    throw new ValidationError(
      "Fiyat onayı yalnızca araç atandıktan sonra ve araç yola çıkmadan önce yapılabilir."
    );
  }

  const result = await shipmentRepository.approveShipmentPrice(shipmentId);
  if (result.count === 0) {
    // Lost the race against a concurrent HEADING_TO_PICKUP transition (or
    // a concurrent counter-offer) between the check above and here.
    throw new ValidationError(
      "Fiyat onayı yalnızca araç atandıktan sonra ve araç yola çıkmadan önce yapılabilir."
    );
  }

  const updated = await shipmentRepository.getShipmentForTenant(
    ctx,
    shipmentId
  );
  if (!updated) throw new NotFoundError("Sefer bulunamadı.");

  try {
    const isCustomerApproving = ctx.companyType === CompanyType.CUSTOMER;
    await notificationService.notifyPriceApproved({
      recipientCompanyId: isCustomerApproving
        ? updated.supplierCompanyId!
        : updated.customerCompanyId,
      recipientRole: isCustomerApproving ? "SUPPLIER" : "CUSTOMER",
      accepterCompanyName: isCustomerApproving
        ? updated.customerCompany.name
        : (updated.supplierCompany?.name ?? "Tedarikçi"),
      shipment: updated,
    });
  } catch (error) {
    console.error("Fiyat onayı bildirimi oluşturulamadı:", error);
  }

  return updated;
}

/**
 * Puts a new price on the table — either a fresh counter-offer or a
 * self-revision of one's own still-pending offer (e.g. fixing a typo
 * before the other side has responded; no restriction against it, since
 * it can't be abused to dodge the priceProposedBy approval check above).
 * Usable by either side any time before final approval. Backs both the
 * standalone "Yeni Fiyat Öner" action and rejectPrice's optional
 * counterAmount below.
 */
export async function proposePrice(
  ctx: TenantContext,
  shipmentId: string,
  rawInput: unknown
) {
  const input = priceProposalInputSchema.parse(rawInput);

  const shipment = await shipmentRepository.getShipmentForTenant(
    ctx,
    shipmentId
  );
  if (!shipment) throw new NotFoundError("Sefer bulunamadı.");
  if (shipment.priceApprovedAt) {
    throw new ValidationError("Fiyat zaten onaylandı, yeni teklif girilemez.");
  }
  if (shipment.status !== ShipmentStatus.ASSIGNED) {
    throw new ValidationError(
      "Fiyat teklifi yalnızca araç atandıktan sonra ve araç yola çıkmadan önce girilebilir."
    );
  }

  const result = await shipmentRepository.proposeShipmentPrice(
    ctx,
    shipmentId,
    ctx.companyType,
    input.amount
  );
  if (result.count === 0) {
    throw new ValidationError(
      "Fiyat teklifi yalnızca araç atandıktan sonra ve araç yola çıkmadan önce girilebilir."
    );
  }

  const updated = await shipmentRepository.getShipmentForTenant(
    ctx,
    shipmentId
  );
  if (!updated) throw new NotFoundError("Sefer bulunamadı.");

  try {
    const isCustomerProposing = ctx.companyType === CompanyType.CUSTOMER;
    await notificationService.notifyPriceProposed({
      recipientCompanyId: isCustomerProposing
        ? updated.supplierCompanyId!
        : updated.customerCompanyId,
      proposerCompanyName: isCustomerProposing
        ? updated.customerCompany.name
        : (updated.supplierCompany?.name ?? "Tedarikçi"),
      amount: input.amount,
      shipment: updated,
    });
  } catch (error) {
    console.error("Fiyat teklifi bildirimi oluşturulamadı:", error);
  }

  return updated;
}

/**
 * The receiving side rejects the current price. With a counterAmount this
 * is really just a new proposal attributed to the rejecting side (delegates
 * to proposePrice); without one it's a bare "no" — priceRejectedAt is set
 * and the ball stays with the original proposer to call proposePrice
 * themselves with a different number.
 */
export async function rejectPrice(
  ctx: TenantContext,
  shipmentId: string,
  rawInput: unknown
) {
  const input = priceRejectionInputSchema.parse(rawInput);

  const shipment = await shipmentRepository.getShipmentForTenant(
    ctx,
    shipmentId
  );
  if (!shipment) throw new NotFoundError("Sefer bulunamadı.");
  if (shipment.agreedPrice === null) {
    throw new ValidationError("Reddedilecek bir nakliye fiyatı bulunmuyor.");
  }
  if (shipment.priceApprovedAt) {
    throw new ValidationError("Fiyat zaten onaylandı, reddedilemez.");
  }
  if (shipment.priceProposedBy === ctx.companyType) {
    throw new ValidationError("Kendi teklif ettiğiniz fiyatı reddedemezsiniz.");
  }

  if (input.counterAmount !== undefined) {
    return proposePrice(ctx, shipmentId, { amount: input.counterAmount });
  }

  if (shipment.status !== ShipmentStatus.ASSIGNED) {
    throw new ValidationError(
      "Fiyat reddi yalnızca araç atandıktan sonra ve araç yola çıkmadan önce yapılabilir."
    );
  }

  const result = await shipmentRepository.rejectShipmentPrice(ctx, shipmentId);
  if (result.count === 0) {
    throw new ValidationError(
      "Fiyat reddi yalnızca araç atandıktan sonra ve araç yola çıkmadan önce yapılabilir."
    );
  }

  const updated = await shipmentRepository.getShipmentForTenant(
    ctx,
    shipmentId
  );
  if (!updated) throw new NotFoundError("Sefer bulunamadı.");

  try {
    const isCustomerRejecting = ctx.companyType === CompanyType.CUSTOMER;
    await notificationService.notifyPriceRejected({
      recipientCompanyId: isCustomerRejecting
        ? updated.supplierCompanyId!
        : updated.customerCompanyId,
      rejecterCompanyName: isCustomerRejecting
        ? updated.customerCompany.name
        : (updated.supplierCompany?.name ?? "Tedarikçi"),
      shipment: updated,
    });
  } catch (error) {
    console.error("Fiyat reddi bildirimi oluşturulamadı:", error);
  }

  return updated;
}
