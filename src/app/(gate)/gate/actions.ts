"use server";

import { revalidatePath } from "next/cache";

import { requireGateGuardContext } from "@/core/shared/gate-guard-context";
import { logGateEvent } from "@/core/gate-guard/gate-event-service";
import { toActionErrorMessage } from "@/lib/action-error";
import type { GateEventType } from "@/generated/prisma/client";

export type GateFormState = { error?: string } | undefined;

export async function logGateEventAction(
  shipmentId: string,
  eventType: GateEventType
): Promise<GateFormState> {
  try {
    const gateGuardCtx = await requireGateGuardContext();
    await logGateEvent(gateGuardCtx, shipmentId, eventType);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/gate");
  return undefined;
}
