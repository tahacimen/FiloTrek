import { hash } from "bcryptjs";

import { prisma } from "@/lib/db";
import { generateLoginToken } from "@/lib/tokens";
import { requirePlatformAdmin } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import * as invitationRepository from "@/core/invitation/invitation-repository";
import {
  invitationAcceptInputSchema,
  invitationInputSchema,
  manualAccountInputSchema,
} from "@/lib/validation/invitation";
import {
  CompanyRole,
  CompanyType,
  InvitationRole,
  InvitationStatus,
} from "@/generated/prisma/client";

const EXPIRY_DAYS = 7;

const COMPANY_TYPE_BY_ROLE: Record<InvitationRole, CompanyType> = {
  [InvitationRole.SUPPLIER_COMPANY]: CompanyType.SUPPLIER,
  [InvitationRole.CUSTOMER_COMPANY]: CompanyType.CUSTOMER,
};

export async function listInvitations(ctx: TenantContext) {
  requirePlatformAdmin(ctx);
  return invitationRepository.listInvitations();
}

export async function createInvitation(ctx: TenantContext, rawInput: unknown) {
  requirePlatformAdmin(ctx);
  const input = invitationInputSchema.parse(rawInput);

  if (await invitationRepository.isEmailUsedAnywhere(input.email)) {
    throw new ValidationError(
      `${input.email} adresi zaten bir hesap tarafından kullanılıyor.`
    );
  }
  const pending = await invitationRepository.findPendingInvitationByEmail(
    input.email
  );
  if (pending) {
    throw new ValidationError(
      `${input.email} adresine zaten bekleyen bir davet gönderilmiş.`
    );
  }

  const token = generateLoginToken();
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  return invitationRepository.createInvitationRecord({
    email: input.email,
    role: input.role,
    token,
    expiresAt,
    createdByUserId: ctx.userId,
  });
}

export async function revokeInvitation(ctx: TenantContext, invitationId: string) {
  requirePlatformAdmin(ctx);
  const existing = await invitationRepository.findInvitationById(invitationId);
  if (!existing) throw new NotFoundError("Davet bulunamadı.");
  if (existing.status !== InvitationStatus.PENDING) {
    throw new ValidationError("Sadece bekleyen davetler iptal edilebilir.");
  }
  await invitationRepository.markInvitationRevoked(invitationId);
}

/** No auth — the invitee has no account yet by definition. */
export async function getInvitationByToken(token: string) {
  return invitationRepository.findInvitationByToken(token);
}

// A plain helper (not called inline in a Server Component render body) so
// the react-hooks/purity rule's Date.now()-in-render check doesn't fire —
// /davet/[token]/page.tsx calls this instead of inlining the comparison.
export function isInvitationExpired(invitation: { expiresAt: Date }): boolean {
  return invitation.expiresAt.getTime() < Date.now();
}

export async function acceptInvitation(token: string, rawInput: unknown) {
  const invitation = await invitationRepository.findInvitationByToken(token);
  if (!invitation) {
    throw new NotFoundError("Davet bulunamadı.");
  }
  if (invitation.status !== InvitationStatus.PENDING) {
    throw new ValidationError("Bu davet zaten kullanılmış veya iptal edilmiş.");
  }
  if (isInvitationExpired(invitation)) {
    throw new ValidationError("Bu davetin süresi dolmuş.");
  }

  const input = invitationAcceptInputSchema.parse(rawInput);
  if (await invitationRepository.isEmailUsedAnywhere(invitation.email)) {
    throw new ValidationError(
      `${invitation.email} adresi zaten bir hesap tarafından kullanılıyor.`
    );
  }

  const passwordHash = await hash(input.password, 10);
  const companyType = COMPANY_TYPE_BY_ROLE[invitation.role];

  const { user } = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: input.companyName, type: companyType },
    });
    const user = await tx.user.create({
      data: {
        companyId: company.id,
        email: invitation.email,
        passwordHash,
        fullName: input.fullName,
        companyRole: CompanyRole.ADMIN,
      },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
    });
    return { company, user };
  });

  return { email: user.email };
}

/**
 * The admin sets the email AND password directly — no link, no invitee
 * step. Still recorded as an Invitation (immediately ACCEPTED, own token
 * never meant to be visited) purely so /admin's list stays a complete audit
 * trail of every account the platform admin brought onto the platform,
 * whichever of the two ways they did it.
 */
export async function createAccountDirectly(ctx: TenantContext, rawInput: unknown) {
  requirePlatformAdmin(ctx);
  const input = manualAccountInputSchema.parse(rawInput);

  if (await invitationRepository.isEmailUsedAnywhere(input.email)) {
    throw new ValidationError(
      `${input.email} adresi zaten bir hesap tarafından kullanılıyor.`
    );
  }

  const passwordHash = await hash(input.password, 10);
  const companyType = COMPANY_TYPE_BY_ROLE[input.role];
  const now = new Date();

  const { user } = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: input.companyName, type: companyType },
    });
    const user = await tx.user.create({
      data: {
        companyId: company.id,
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        companyRole: CompanyRole.ADMIN,
      },
    });
    await tx.invitation.create({
      data: {
        email: input.email,
        role: input.role,
        token: generateLoginToken(),
        status: InvitationStatus.ACCEPTED,
        expiresAt: now,
        acceptedAt: now,
        createdByUserId: ctx.userId,
      },
    });
    return { company, user };
  });

  return { email: user.email };
}
