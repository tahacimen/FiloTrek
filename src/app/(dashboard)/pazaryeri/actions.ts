"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import * as marketplaceService from "@/core/marketplace/marketplace-service";
import { toActionErrorMessage } from "@/lib/action-error";

export type MarketplaceFormState = { error?: string } | undefined;

function optionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function submitBidAction(
  shipmentId: string,
  _prevState: MarketplaceFormState,
  formData: FormData
): Promise<MarketplaceFormState> {
  try {
    const ctx = await requireTenantContext();
    await marketplaceService.submitBid(ctx, shipmentId, {
      price: formData.get("price"),
      message: optionalFormString(formData, "message"),
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/pazaryeri");
  return undefined;
}

export async function acceptBidAction(
  shipmentId: string,
  bidId: string
): Promise<MarketplaceFormState> {
  try {
    const ctx = await requireTenantContext();
    await marketplaceService.acceptBid(ctx, shipmentId, bidId);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  revalidatePath("/pazaryeri");
  revalidatePath("/dashboard");
  return undefined;
}
