import { hash } from "bcryptjs";

import { prisma } from "@/lib/db";
import { generateLoginToken } from "@/lib/tokens";
import { requirePlatformAdmin } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import * as signupRepository from "@/core/signup/signup-repository";
import * as invitationRepository from "@/core/invitation/invitation-repository";
import * as notificationService from "@/core/notification/notification-service";
import { signupRequestInputSchema } from "@/lib/validation/signup";
import {
  CompanyRole,
  CompanyType,
  InvitationRole,
  InvitationStatus,
  SignupRequestStatus,
} from "@/generated/prisma/client";

const COMPANY_TYPE_BY_ROLE: Record<InvitationRole, CompanyType> = {
  [InvitationRole.SUPPLIER_COMPANY]: CompanyType.SUPPLIER,
  [InvitationRole.CUSTOMER_COMPANY]: CompanyType.CUSTOMER,
};

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

/**
 * One-step "Onayla ve Hesap Oluştur": the admin supplies only a password;
 * everything else (company, name, email, role) comes straight from the
 * pending request. Creates the Company + first ADMIN User exactly like
 * createAccountDirectly (same audit-Invitation trail), and marks the request
 * APPROVED — all in one transaction so a half-approved state can't happen.
 * Returns the applicant's details so the caller can e-mail their credentials.
 */
export async function approveSignupRequestAndCreateAccount(
  ctx: TenantContext,
  id: string,
  password: unknown
) {
  requirePlatformAdmin(ctx);

  if (typeof password !== "string" || password.trim().length < 8) {
    throw new ValidationError("Şifre en az 8 karakter olmalı.");
  }
  const request = await signupRepository.findSignupRequestById(id);
  if (!request) throw new NotFoundError("Kayıt talebi bulunamadı.");
  if (request.status !== SignupRequestStatus.PENDING) {
    throw new ValidationError("Bu talep zaten işleme alınmış.");
  }
  if (await invitationRepository.isEmailUsedAnywhere(request.email)) {
    throw new ValidationError(
      `${request.email} adresi zaten bir hesap tarafından kullanılıyor.`
    );
  }

  const passwordHash = await hash(password.trim(), 10);
  const companyType = COMPANY_TYPE_BY_ROLE[request.role];
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: request.companyName, type: companyType, phone: request.phone },
    });
    await tx.user.create({
      data: {
        companyId: company.id,
        email: request.email,
        passwordHash,
        fullName: request.fullName,
        phone: request.phone,
        companyRole: CompanyRole.ADMIN,
      },
    });
    await tx.invitation.create({
      data: {
        email: request.email,
        role: request.role,
        token: generateLoginToken(),
        status: InvitationStatus.ACCEPTED,
        expiresAt: now,
        acceptedAt: now,
        createdByUserId: ctx.userId,
      },
    });
    await tx.signupRequest.update({
      where: { id: request.id },
      data: { status: SignupRequestStatus.APPROVED },
    });
  });

  return {
    email: request.email,
    fullName: request.fullName,
    companyName: request.companyName,
    password: password.trim(),
  };
}
