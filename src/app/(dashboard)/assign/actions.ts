"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { assignVehicleAndDriver } from "@/core/shipment/shipment-status";
import { toActionErrorMessage } from "@/lib/action-error";

export type AssignFormState = { error?: string } | undefined;

export async function assignShipmentAction(
  shipmentId: string,
  _prevState: AssignFormState,
  formData: FormData
): Promise<AssignFormState> {
  const vehicleId = formData.get("vehicleId");
  const driverId = formData.get("driverId");
  const agreedPriceRaw = formData.get("agreedPrice");

  if (typeof vehicleId !== "string" || !vehicleId) {
    return { error: "Bir araç seçin." };
  }
  if (typeof driverId !== "string" || !driverId) {
    return { error: "Bir şoför seçin." };
  }

  // Price is optional here: a bid-accepted shipment already has an agreed
  // price, so the dialog omits the field entirely. When present it's still
  // validated; when absent the service keeps the already-agreed price (and
  // enforces the "required" rule for the direct-request flow).
  let agreedPrice: number | undefined;
  if (typeof agreedPriceRaw === "string" && agreedPriceRaw.length > 0) {
    const parsed = Number(agreedPriceRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { error: "Geçerli bir nakliye fiyatı girin." };
    }
    agreedPrice = parsed;
  }

  try {
    const ctx = await requireTenantContext();
    await assignVehicleAndDriver(ctx, {
      shipmentId,
      vehicleId,
      driverId,
      agreedPrice,
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }

  revalidatePath("/assign");
  revalidatePath("/shipments");
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/vehicles");
  revalidatePath("/drivers");
  revalidatePath("/dashboard");
  return undefined;
}
