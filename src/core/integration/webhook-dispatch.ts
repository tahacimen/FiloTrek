import * as companyRepository from "@/core/company/company-repository";
import { signWebhookPayload } from "@/lib/webhook-signing";
import type { Shipment, ShipmentStatus } from "@/generated/prisma/client";

type ShipmentStatusChangedPayload = {
  event: "shipment.status_changed";
  shipment_id: string;
  tracking_number: number;
  from_status: ShipmentStatus;
  to_status: ShipmentStatus;
  occurred_at: string;
};

async function postSignedWebhook(
  webhookUrl: string,
  webhookSecret: string,
  payload: ShipmentStatusChangedPayload
) {
  const rawBody = JSON.stringify(payload);
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Logigo-Signature": signWebhookPayload(rawBody, webhookSecret),
    },
    body: rawBody,
  });
  if (!response.ok) {
    throw new Error(`Webhook endpoint returned ${response.status}`);
  }
}

/**
 * Best-effort, single-attempt outbound notification to whichever side(s)
 * of a shipment have configured a webhookUrl+webhookSecret (see the
 * Company schema comment and /settings). Deliberately no retry schedule —
 * a failed delivery is logged and dropped, not queued; a Stripe-style
 * multi-day retry infrastructure would be disproportionate at this app's
 * scale. Only ever called from advanceShipmentStatusCore, so this covers
 * every shipment status transition EXCEPT assignVehicleAndDriver's PENDING
 * -> ASSIGNED and cancelShipment's -> CANCELLED, which run their own
 * separate transactions outside that shared core.
 */
export async function dispatchShipmentStatusWebhook(
  shipment: Pick<
    Shipment,
    "id" | "trackingNumber" | "customerCompanyId" | "supplierCompanyId"
  >,
  fromStatus: ShipmentStatus,
  toStatus: ShipmentStatus
) {
  const companyIds = [
    shipment.customerCompanyId,
    shipment.supplierCompanyId,
  ].filter((id): id is string => id !== null);

  const companies = await Promise.all(
    companyIds.map((id) => companyRepository.getCompanyById(id))
  );

  const payload: ShipmentStatusChangedPayload = {
    event: "shipment.status_changed",
    shipment_id: shipment.id,
    tracking_number: shipment.trackingNumber,
    from_status: fromStatus,
    to_status: toStatus,
    occurred_at: new Date().toISOString(),
  };

  await Promise.all(
    companies.map(async (company) => {
      if (!company?.webhookUrl || !company.webhookSecret) return;
      try {
        await postSignedWebhook(company.webhookUrl, company.webhookSecret, payload);
      } catch (error) {
        console.error(`Webhook gönderilemedi (firma ${company.id}):`, error);
      }
    })
  );
}
