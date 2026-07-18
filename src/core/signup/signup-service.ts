import { requirePlatformAdmin } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import * as signupRepository from "@/core/signup/signup-repository";
import * as invitationRepository from "@/core/invitation/invitation-repository";
import * as notificationService from "@/core/notification/notification-service";
import { signupRequestInputSchema } from "@/lib/validation/signup";
import { SignupRequestStatus } from "@/generated/prisma/client";

/**
 * Public — the applicant has no account by definition. Validates, blocks the
 * obvious duplicates (an email that's already an account, or that already has
 * a pending application), records the request, then best-effort pings the
 * platform admin(s). A notification failure must never fail the submission,
 * so it's swallowed here (the request itself is already safely persisted).
 */
export async function createSignupRequest(rawInput: unknown) {
  const input = signupRequestInputSchema.parse(rawInput);
  const phone = input.phone ? input.phone : null;
  const message = input.message ? input.message : null;

  if (await invitationRepository.isEmailUsedAnywhere(input.email)) {
    throw new ValidationError(
      `${input.email} adresi zaten bir hesap tarafından kullanılıyor. Giriş yapmayı deneyin.`
    );
  }
  if (await signupRepository.findPendingSignupRequestByEmail(input.email)) {
    throw new ValidationError(
      "Bu e-posta için zaten bekleyen bir kayıt talebi var. En kısa sürede sizinle iletişime geçeceğiz."
    );
  }

  const request = await signupRepository.createSignupRequest({
    companyName: input.companyName,
    fullName: input.fullName,
    email: input.email,
    phone,
    role: input.role,
    message,
  });

  try {
    const adminCompanyIds = await signupRepository.platformAdminCompanyIds();
    if (adminCompanyIds.length > 0) {
      await notificationService.notifySignupRequest({
        adminCompanyIds,
        companyName: request.companyName,
        fullName: request.fullName,
        email: request.email,
      });
    }
  } catch (error) {
    console.error("Kayıt talebi bildirimi gönderilemedi:", error);
  }

  return { id: request.id };
}

export async function listSignupRequests(ctx: TenantContext) {
  requirePlatformAdmin(ctx);
  return signupRepository.listSignupRequests();
}

export async function setSignupRequestStatus(
  ctx: TenantContext,
  id: string,
  status: SignupRequestStatus
) {
  requirePlatformAdmin(ctx);
  if (status === SignupRequestStatus.PENDING) {
    throw new ValidationError("Geçersiz durum.");
  }
  const existing = await signupRepository.findSignupRequestById(id);
  if (!existing) throw new NotFoundError("Kayıt talebi bulunamadı.");
  return signupRepository.updateSignupRequestStatus(id, status);
}
