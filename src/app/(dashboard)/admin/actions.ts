"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import * as invitationService from "@/core/invitation/invitation-service";
import * as notificationService from "@/core/notification/notification-service";
import { getRequestOrigin } from "@/lib/request-origin";
import { toActionErrorMessage } from "@/lib/action-error";

export type InvitationFormState = { error?: string } | undefined;

export async function createInvitationAction(
  _prevState: InvitationFormState,
  formData: FormData
): Promise<InvitationFormState> {
  try {
    const ctx = await requireTenantContext();
    const input = {
      email: formData.get("email"),
      role: formData.get("role"),
    };
    const invitation = await invitationService.createInvitation(ctx, input);
    const origin = await getRequestOrigin();
    await notificationService.notifyInvitation({
      email: invitation.email,
      role: invitation.role,
      invitationUrl: `${origin}/davet/${invitation.token}`,
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/admin");
  return undefined;
}

export async function revokeInvitationAction(
  invitationId: string
): Promise<InvitationFormState> {
  try {
    const ctx = await requireTenantContext();
    await invitationService.revokeInvitation(ctx, invitationId);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/admin");
  return undefined;
}
