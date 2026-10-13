"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { setShipmentPayment } from "@/core/shipment/shipment-payment";
import { toActionErrorMessage } from "@/lib/action-error";

export type PaymentFormState = { error?: string } | undefined;

export async function setShipmentPaymentAction(
  shipmentId: string,
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  try {
    const ctx = await requireTenantContext();
    await setShipmentPayment(ctx, shipmentId, {
      status: formData.get("status"),
      dueDate: formData.get("dueDate"),
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/shipments/${shipmentId}`);
  return undefined;
}
