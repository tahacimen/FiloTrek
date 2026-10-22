"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import {
  parseAndCreateBulk,
  type BulkResult,
} from "@/core/shipment/bulk-request-service";
import { toActionErrorMessage } from "@/lib/action-error";

export type BulkFormState =
  | { result: BulkResult }
  | { error: string }
  | undefined;

export async function bulkRequestAction(
  _prev: BulkFormState,
  formData: FormData
): Promise<BulkFormState> {
  try {
    const ctx = await requireTenantContext();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Lütfen bir Excel dosyası seçin." };
    }
    const buffer = await file.arrayBuffer();
    const result = await parseAndCreateBulk(ctx, buffer);
    revalidatePath("/shipments");
    revalidatePath("/assign");
    revalidatePath("/dashboard");
    return { result };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
