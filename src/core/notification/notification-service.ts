import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError } from "@/core/shared/errors";
import * as notificationRepository from "@/core/notification/notification-repository";
import * as emailService from "@/core/notification/email-service";
import { InvitationRole, NotificationType } from "@/generated/prisma/client";

/**
 * Fires after the in-app notification has already been written — email is
 * an ADDITIONAL prompt for a subset of "needs attention now" events, never
 * a replacement for the bell (see notifyPriceProposed/notifyIncidentReported/
 * notifyDriverCompletedDelivery, the only three callers). Wrapped in its own
 * catch so an email failure (or SMTP_HOST simply not being configured yet)
 * never surfaces to the caller — sendEmailToCompany already catches
 * per-recipient internally, this is defense in depth for anything else
 * (e.g. the user lookup itself) going wrong.
 */
async function emailCompanyBestEffort(
  companyId: string,
  subject: string,
  text: string
) {
  try {
    await emailService.sendEmailToCompany(companyId, subject, text);
  } catch (error) {
    console.error("E-posta gönderilemedi:", error);
  }
}

export async function listRecentNotifications(
  ctx: TenantContext,
  limit = 10
) {
  const [notifications, unreadCount] = await Promise.all([
    notificationRepository.listRecentNotificationsForTenant(ctx, limit),
    notificationRepository.countUnreadForTenant(ctx),
  ]);
  return { notifications, unreadCount };
}

export async function markAsRead(ctx: TenantContext, notificationId: string) {
  const notification = await notificationRepository.findNotificationForTenant(
    ctx,
    notificationId
  );
  if (!notification) throw new NotFoundError("Bildirim bulunamadı.");
  if (notification.isRead) return notification;
  return notificationRepository.markNotificationRead(notification.id);
}

export async function markAllAsRead(ctx: TenantContext) {
  return notificationRepository.markAllNotificationsRead(ctx);
}

/**
 * Best-effort side effect of a customer creating a shipment request — callers
 * must never let a failure here fail the shipment creation itself (see
 * createShipmentRequest in shipment-service.ts).
 */
export async function notifyShipmentRequested(params: {
  supplierCompanyId: string;
  customerCompanyName: string;
  shipment: { id: string; originAddress: string; destinationAddress: string };
}) {
  const message = `${params.customerCompanyName} firmasından ${params.shipment.originAddress} → ${params.shipment.destinationAddress} güzergahı için yeni sefer talebi.`;
  return notificationRepository.createNotification({
    companyId: params.supplierCompanyId,
    type: NotificationType.SHIPMENT_REQUESTED,
    message,
    relatedShipmentId: params.shipment.id,
  });
}

/**
 * Best-effort side effect of a customer marking cargo ready — see
 * markLoadReady in shipment-service.ts for why a notification failure must
 * never fail that action.
 */
export async function notifyLoadReady(params: {
  supplierCompanyId: string;
  customerCompanyName: string;
  shipment: { id: string; originAddress: string; destinationAddress: string };
}) {
  const message = `${params.customerCompanyName} firmasından ${params.shipment.originAddress} → ${params.shipment.destinationAddress} seferi için yük hazır bildirimi geldi. Aracı gönderebilirsiniz.`;
  return notificationRepository.createNotification({
    companyId: params.supplierCompanyId,
    type: NotificationType.LOAD_READY,
    message,
    relatedShipmentId: params.shipment.id,
  });
}

/**
 * Emails the assigned driver directly — not the in-app notification feed,
 * since Driver isn't a User and has no feed of its own — as soon as the
 * customer confirms cargo is ready, with the gate info and whichever
 * navigation link is available at that point. Best-effort, same as every
 * other notification here; see the call site in shipment-service.ts's
 * markLoadReady. Silently does nothing if the driver has no email set
 * (login is opt-in — see the Driver model comment in schema.prisma).
 */
export async function notifyDriverLoadReady(params: {
  driverEmail: string | null;
  driverFullName: string;
  shipment: {
    originAddress: string;
    destinationAddress: string;
    pickupGateInfo: string | null;
    pickupMapsUrl: string | null;
    originMapsUrl: string | null;
  };
}) {
  if (!params.driverEmail) return;

  const navUrl = params.shipment.pickupMapsUrl ?? params.shipment.originMapsUrl;
  const lines = [
    `Merhaba ${params.driverFullName},`,
    "",
    `${params.shipment.originAddress} → ${params.shipment.destinationAddress} seferi için yük hazır.`,
    params.shipment.pickupGateInfo
      ? `Kapı / Rampa: ${params.shipment.pickupGateInfo}`
      : null,
    navUrl ? `Navigasyon: ${navUrl}` : "Navigasyon linki henüz paylaşılmadı.",
  ].filter((line): line is string => line !== null);

  await emailService
    .sendEmail({
      to: params.driverEmail,
      subject: "Yükleme noktanız hazır",
      text: lines.join("\n"),
    })
    .catch((error) => {
      console.error(
        "Şoföre yükleme bildirimi e-postası gönderilemedi:",
        error
      );
    });
}

/**
 * Unlike every other notification in this file, sending the email here IS
 * the point of the calling action (a dispatcher explicitly clicked "send
 * link") rather than a side effect of one — so this deliberately does NOT
 * swallow the error the way emailCompanyBestEffort/notifyDriverLoadReady
 * do. A real send failure should surface back to the dispatcher as a
 * visible error, not vanish into a console.error the way an ancillary
 * notification is allowed to.
 */
export async function notifyDriverLoginLink(params: {
  driverEmail: string;
  driverFullName: string;
  loginUrl: string;
}) {
  const lines = [
    `Merhaba ${params.driverFullName},`,
    "",
    "Şifre girmeden şoför ekranınıza ulaşmak için aşağıdaki bağlantıyı kullanabilirsiniz:",
    params.loginUrl,
    "",
    "Bu bağlantıyı kimseyle paylaşmayın.",
  ];
  await emailService.sendEmail({
    to: params.driverEmail,
    subject: "Logigo giriş bağlantınız",
    text: lines.join("\n"),
  });
}

const INVITATION_ROLE_LABELS: Record<InvitationRole, string> = {
  [InvitationRole.SUPPLIER_COMPANY]: "Tedarikçi",
  [InvitationRole.CUSTOMER_COMPANY]: "Müşteri",
};

/**
 * Same non-swallowing rationale as notifyDriverLoginLink above: a platform
 * admin explicitly clicked "Davet Gönder", so a real send failure must
 * surface back as a visible error rather than vanish silently.
 */
export async function notifyInvitation(params: {
  email: string;
  role: InvitationRole;
  invitationUrl: string;
}) {
  const roleLabel = INVITATION_ROLE_LABELS[params.role];
  const lines = [
    "Merhaba,",
    "",
    `Logigo'ya ${roleLabel} hesabı olarak davet edildiniz. Hesabınızı ` +
      "oluşturmak için aşağıdaki bağlantıyı kullanın:",
    params.invitationUrl,
    "",
    "Bu bağlantı 7 gün geçerlidir ve yalnızca bir kez kullanılabilir.",
  ];
  await emailService.sendEmail({
    to: params.email,
    subject: "Logigo davetiniz",
    text: lines.join("\n"),
  });
}

/**
 * Best-effort side effect of the supplier advancing a shipment to
 * HEADING_TO_PICKUP — see the hook in shipment-status.ts's
 * advanceShipmentStatus for why a notification failure must never fail that
 * transition.
 */
export async function notifyVehicleDeparted(params: {
  customerCompanyId: string;
  supplierCompanyName: string;
  shipment: { id: string; originAddress: string };
}) {
  const message = `${params.supplierCompanyName} firmasına ait araç ${params.shipment.originAddress} adresine doğru yola çıktı.`;
  return notificationRepository.createNotification({
    companyId: params.customerCompanyId,
    type: NotificationType.VEHICLE_DEPARTED,
    message,
    relatedShipmentId: params.shipment.id,
  });
}

/**
 * Best-effort side effect of either side putting a new price on the table
 * — the original assignment-time price (supplier -> customer) and every
 * later counter-offer in the negotiation (either direction) all funnel
 * through here, since they're the same event from the recipient's point of
 * view: "a price is now waiting on your response." See assignVehicleAndDriver
 * and proposePrice in shipment-status.ts/shipment-service.ts for why a
 * notification failure must never fail the underlying transaction/action.
 */
export async function notifyPriceProposed(params: {
  recipientCompanyId: string;
  proposerCompanyName: string;
  amount: number;
  shipment: { id: string; originAddress: string; destinationAddress: string };
}) {
  const price = params.amount.toLocaleString("tr-TR");
  const message = `${params.proposerCompanyName} firmasından ${params.shipment.originAddress} → ${params.shipment.destinationAddress} seferi için ${price} ₺ nakliye fiyatı teklif edildi.`;
  const notification = await notificationRepository.createNotification({
    companyId: params.recipientCompanyId,
    type: NotificationType.PRICE_PROPOSED,
    message,
    relatedShipmentId: params.shipment.id,
  });
  await emailCompanyBestEffort(
    params.recipientCompanyId,
    "Nakliye fiyatı onayınızı bekliyor",
    message
  );
  return notification;
}

/**
 * Best-effort side effect of either side accepting the price currently on
 * the table — see approvePrice in shipment-service.ts. The message differs
 * by which side is being notified: the supplier is told they can now send
 * the vehicle off, while a customer being notified (their own counter-offer
 * got accepted) has no such next action.
 */
export async function notifyPriceApproved(params: {
  recipientCompanyId: string;
  recipientRole: "SUPPLIER" | "CUSTOMER";
  accepterCompanyName: string;
  shipment: { id: string; originAddress: string; destinationAddress: string };
}) {
  const route = `${params.shipment.originAddress} → ${params.shipment.destinationAddress}`;
  const message =
    params.recipientRole === "SUPPLIER"
      ? `${params.accepterCompanyName} firması ${route} seferi için nakliye fiyatını onayladı. Aracı yola çıkarabilirsiniz.`
      : `${params.accepterCompanyName} firması ${route} seferi için önerdiğiniz nakliye fiyatını kabul etti.`;
  return notificationRepository.createNotification({
    companyId: params.recipientCompanyId,
    type: NotificationType.PRICE_APPROVED,
    message,
    relatedShipmentId: params.shipment.id,
  });
}

/**
 * Best-effort side effect of the receiving side rejecting the current price
 * with no counter-offer — see rejectPrice in shipment-service.ts. Only fires
 * for a bare rejection; a rejection WITH a counter-price is a new proposal
 * and goes through notifyPriceProposed instead.
 */
export async function notifyPriceRejected(params: {
  recipientCompanyId: string;
  rejecterCompanyName: string;
  shipment: { id: string; originAddress: string; destinationAddress: string };
}) {
  const message = `${params.rejecterCompanyName} firması ${params.shipment.originAddress} → ${params.shipment.destinationAddress} seferi için önerilen nakliye fiyatını reddetti. Yeni bir fiyat girmeniz gerekiyor.`;
  return notificationRepository.createNotification({
    companyId: params.recipientCompanyId,
    type: NotificationType.PRICE_REJECTED,
    message,
    relatedShipmentId: params.shipment.id,
  });
}

type GateEventNotifyParams = {
  customerCompanyId: string;
  gateGuardName: string;
  shipment: { id: string; originAddress: string; destinationAddress: string };
};

/**
 * Informs the gate guard's own (CUSTOMER) company — the dispatcher/admin
 * side sees this in their existing bell, same as every other shipment
 * lifecycle event. No email: unlike price/incident events this isn't
 * something that blocks progress or needs urgent attention, just a live
 * feed of physical activity at the gate.
 */
export async function notifyVehicleEnteredGate(params: GateEventNotifyParams) {
  const message = `${params.gateGuardName}, ${params.shipment.originAddress} → ${params.shipment.destinationAddress} seferindeki aracın giriş yaptığını bildirdi.`;
  return notificationRepository.createNotification({
    companyId: params.customerCompanyId,
    type: NotificationType.VEHICLE_ENTERED_GATE,
    message,
    relatedShipmentId: params.shipment.id,
  });
}

export async function notifyVehicleExitedGate(params: GateEventNotifyParams) {
  const message = `${params.gateGuardName}, ${params.shipment.originAddress} → ${params.shipment.destinationAddress} seferindeki aracın çıkış yaptığını bildirdi.`;
  return notificationRepository.createNotification({
    companyId: params.customerCompanyId,
    type: NotificationType.VEHICLE_EXITED_GATE,
    message,
    relatedShipmentId: params.shipment.id,
  });
}

type DriverMilestoneParams = {
  customerCompanyId: string;
  customerCompanyName: string;
  supplierCompanyId: string;
  supplierCompanyName: string;
  driverName: string;
  shipment: { id: string; originAddress: string; destinationAddress: string };
};

/**
 * Driver-triggered milestones notify both sides of the shipment (unlike the
 * dispatcher-triggered transitions above, which each only notify one) — the
 * customer wants to know their vehicle moved regardless of who reported it,
 * and the dispatcher wants a live feed of their own driver's progress.
 * Messages are written separately per side (not identical text) since each
 * reads it from a different perspective.
 */
async function notifyBothSides(
  type: NotificationType,
  params: {
    customerCompanyId: string;
    supplierCompanyId: string;
    customerMessage: string;
    supplierMessage: string;
    relatedShipmentId: string;
  }
) {
  await Promise.all([
    notificationRepository.createNotification({
      companyId: params.customerCompanyId,
      type,
      message: params.customerMessage,
      relatedShipmentId: params.relatedShipmentId,
    }),
    notificationRepository.createNotification({
      companyId: params.supplierCompanyId,
      type,
      message: params.supplierMessage,
      relatedShipmentId: params.relatedShipmentId,
    }),
  ]);
}

export async function notifyDriverArrivedPickup(params: DriverMilestoneParams) {
  return notifyBothSides(NotificationType.DRIVER_ARRIVED_PICKUP, {
    customerCompanyId: params.customerCompanyId,
    supplierCompanyId: params.supplierCompanyId,
    customerMessage: `${params.supplierCompanyName} firmasının aracı yükleme noktasına vardı.`,
    supplierMessage: `${params.driverName} yükleme noktasına vardı.`,
    relatedShipmentId: params.shipment.id,
  });
}

export async function notifyDriverAtPickupGate(params: DriverMilestoneParams) {
  return notifyBothSides(NotificationType.DRIVER_AT_PICKUP_GATE, {
    customerCompanyId: params.customerCompanyId,
    supplierCompanyId: params.supplierCompanyId,
    customerMessage: `${params.supplierCompanyName} firmasının aracı depo kapısına vardı, yüklemeye hazır.`,
    supplierMessage: `${params.driverName} depo kapısına vardı, yüklemeye hazır.`,
    relatedShipmentId: params.shipment.id,
  });
}

export async function notifyDriverDepartedPickup(
  params: DriverMilestoneParams
) {
  return notifyBothSides(NotificationType.DRIVER_DEPARTED_PICKUP, {
    customerCompanyId: params.customerCompanyId,
    supplierCompanyId: params.supplierCompanyId,
    customerMessage: `${params.supplierCompanyName} firmasının aracı yükü teslim aldı, yola çıktı.`,
    supplierMessage: `${params.driverName} yükü teslim aldı, yola çıktı.`,
    relatedShipmentId: params.shipment.id,
  });
}

export async function notifyDriverArrivedDelivery(
  params: DriverMilestoneParams
) {
  return notifyBothSides(NotificationType.DRIVER_ARRIVED_DELIVERY, {
    customerCompanyId: params.customerCompanyId,
    supplierCompanyId: params.supplierCompanyId,
    customerMessage: `${params.supplierCompanyName} firmasının aracı teslimat noktasına vardı.`,
    supplierMessage: `${params.driverName} teslimat noktasına vardı.`,
    relatedShipmentId: params.shipment.id,
  });
}

export async function notifyDriverCompletedDelivery(
  params: DriverMilestoneParams
) {
  const customerMessage = `Malınız teslim edildi.`;
  const supplierMessage = `${params.driverName} teslimatı tamamladı.`;
  await notifyBothSides(NotificationType.DRIVER_COMPLETED_DELIVERY, {
    customerCompanyId: params.customerCompanyId,
    supplierCompanyId: params.supplierCompanyId,
    customerMessage,
    supplierMessage,
    relatedShipmentId: params.shipment.id,
  });
  await Promise.all([
    emailCompanyBestEffort(
      params.customerCompanyId,
      "Teslimatınız tamamlandı",
      customerMessage
    ),
    emailCompanyBestEffort(
      params.supplierCompanyId,
      "Teslimat tamamlandı",
      supplierMessage
    ),
  ]);
}

type IncidentNotifyParams = {
  customerCompanyId: string;
  customerCompanyName: string;
  supplierCompanyId: string;
  supplierCompanyName: string;
  /** The reporting driver for a report, or whoever resolved it for a resolution. */
  actorName: string;
  shipment: { id: string; originAddress: string; destinationAddress: string };
};

export async function notifyIncidentReported(params: IncidentNotifyParams) {
  const customerMessage = `${params.supplierCompanyName} firmasının aracında arıza bildirildi (${params.shipment.originAddress} → ${params.shipment.destinationAddress}).`;
  const supplierMessage = `${params.actorName} arıza bildirdi (${params.shipment.originAddress} → ${params.shipment.destinationAddress}).`;
  await notifyBothSides(NotificationType.INCIDENT_REPORTED, {
    customerCompanyId: params.customerCompanyId,
    supplierCompanyId: params.supplierCompanyId,
    customerMessage,
    supplierMessage,
    relatedShipmentId: params.shipment.id,
  });
  await Promise.all([
    emailCompanyBestEffort(params.customerCompanyId, "Arıza bildirildi", customerMessage),
    emailCompanyBestEffort(params.supplierCompanyId, "Arıza bildirildi", supplierMessage),
  ]);
}

export async function notifyIncidentResolved(params: IncidentNotifyParams) {
  return notifyBothSides(NotificationType.INCIDENT_RESOLVED, {
    customerCompanyId: params.customerCompanyId,
    supplierCompanyId: params.supplierCompanyId,
    customerMessage: `${params.supplierCompanyName} firmasının aracındaki arıza giderildi, sefer devam ediyor.`,
    supplierMessage: `Arıza giderildi (${params.actorName}), sefer devam ediyor.`,
    relatedShipmentId: params.shipment.id,
  });
}
