"use server";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { getShipment } from "@/core/shipment/shipment-service";
import { getActiveReservationForShipment } from "@/core/warehouse/dock-reservation-service";
import { issueDriverLoginToken } from "@/core/driver/driver-service";
import { getRequestOrigin } from "@/lib/request-origin";
import { toActionErrorMessage } from "@/lib/action-error";

export type NotifyDriverResult =
  | { url: string; phone: string; message: string }
  | { error: string };

/**
 * Prepares a one-tap WhatsApp notification for the assigned driver once the
 * price is agreed: issues a fresh passwordless login link and returns it plus
 * a ready-made message (route + pickup + link). The dispatcher taps send from
 * the client — no paid WhatsApp API. Supplier-only; requires an assigned
 * driver and an approved price (the exact moment the user asked for).
 */
export async function notifyDriverWhatsAppAction(
  shipmentId: string
): Promise<NotifyDriverResult> {
  try {
    const ctx = await requireTenantContext();
    if (ctx.companyType !== "SUPPLIER") {
      return { error: "Bu işlem yalnızca tedarikçi tarafından yapılabilir." };
    }
    const shipment = await getShipment(ctx, shipmentId);
    if (!shipment.driverId || !shipment.driver) {
      return { error: "Bu sefere henüz şoför atanmadı." };
    }
    if (!shipment.priceApprovedAt) {
      return { error: "Önce fiyatın onaylanması gerekir." };
    }

    const reservation = await getActiveReservationForShipment(
      ctx,
      shipmentId
    ).catch(() => null);

    const { token, phone, fullName } = await issueDriverLoginToken(
      ctx,
      shipment.driverId
    );
    const origin = await getRequestOrigin();
    const url = `${origin}/api/driver-login/${token}`;

    const pickupLine = reservation
      ? `Yükleme: ${reservation.dock.warehouse.name}${
          reservation.dock.warehouse.address
            ? ` (${reservation.dock.warehouse.address})`
            : ""
        } — Rampa ${reservation.dock.name}`
      : shipment.pickupGateInfo
        ? `Yükleme bilgisi: ${shipment.pickupGateInfo}`
        : `Yükleme noktası: ${shipment.originAddress}`;

    const message = [
      `Merhaba ${fullName},`,
      `${shipment.originAddress} → ${shipment.destinationAddress} seferiniz onaylandı.`,
      pickupLine,
      `Sefer detaylarınız ve yol tarifi için panelinize girin: ${url}`,
    ].join("\n");

    return { url, phone, message };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
