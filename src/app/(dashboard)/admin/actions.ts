"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import * as invitationService from "@/core/invitation/invitation-service";
import * as notificationService from "@/core/notification/notification-service";
import * as signupService from "@/core/signup/signup-service";
import * as demoService from "@/core/demo/demo-service";
import * as demoProvision from "@/core/demo/demo-provision";
import { getRequestOrigin } from "@/lib/request-origin";
import { toActionErrorMessage } from "@/lib/action-error";
import {
  DemoRequestStatus,
  SignupRequestStatus,
} from "@/generated/prisma/client";

export type InvitationFormState = { error?: string } | undefined;

export async function setDemoRequestStatusAction(
  id: string,
  status: DemoRequestStatus
): Promise<InvitationFormState> {
  try {
    const ctx = await requireTenantContext();
    await demoService.setDemoRequestStatus(ctx, id, status);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/admin");
  return undefined;
}

/**
 * Owner provisions an isolated, time-limited sandbox demo for a request and
 * marks the request contacted. The magic-links surface in the "Demo Ortamları"
 * list for the owner to forward.
 */
export async function provisionDemoInstanceAction(
  demoRequestId: string,
  companyLabel: string
): Promise<InvitationFormState> {
  try {
    const ctx = await requireTenantContext();
    await demoProvision.provisionDemoInstance(ctx, {
      demoRequestId,
      companyLabel,
    });
    await demoService.setDemoRequestStatus(
      ctx,
      demoRequestId,
      DemoRequestStatus.CONTACTED
    );
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/admin");
  return undefined;
}

export async function revokeDemoInstanceAction(
  id: string
): Promise<InvitationFormState> {
  try {
    const ctx = await requireTenantContext();
    await demoProvision.revokeDemoInstance(ctx, id);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/admin");
  return undefined;
}

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

export async function createAccountManuallyAction(
  _prevState: InvitationFormState,
  formData: FormData
): Promise<InvitationFormState> {
  try {
    const ctx = await requireTenantContext();
    const input = {
      email: formData.get("email"),
      role: formData.get("role"),
      companyName: formData.get("companyName"),
      fullName: formData.get("fullName"),
      password: formData.get("password"),
    };
    await invitationService.createAccountDirectly(ctx, input);
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

export async function rejectSignupRequestAction(
  id: string
): Promise<InvitationFormState> {
  try {
    const ctx = await requireTenantContext();
    await signupService.setSignupRequestStatus(
      ctx,
      id,
      SignupRequestStatus.REJECTED
    );
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/admin");
  return undefined;
}

export async function approveSignupRequestAction(
  id: string,
  _prevState: InvitationFormState,
  formData: FormData
): Promise<InvitationFormState> {
  try {
    const ctx = await requireTenantContext();
    const account = await signupService.approveSignupRequestAndCreateAccount(
      ctx,
      id,
      formData.get("password")
    );
    const origin = await getRequestOrigin();
    try {
      await notificationService.notifyAccountApproved({
        email: account.email,
        fullName: account.fullName,
        password: account.password,
        loginUrl: `${origin}/login`,
      });
    } catch (error) {
      console.error("Onay e-postası gönderilemedi:", error);
    }
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/admin");
  return undefined;
}
