import { afterAll, describe, expect, it } from "vitest";
import { compare } from "bcryptjs";

import { prisma } from "@/lib/db";
import * as invitationService from "@/core/invitation/invitation-service";
import { NotFoundError, UnauthorizedError, ValidationError } from "@/core/shared/errors";
import {
  cleanupCompanies,
  createCustomerContext,
  createPlatformAdminContext,
  createTestUser,
} from "@/test/fixtures";
import { CompanyType, InvitationRole, InvitationStatus } from "@/generated/prisma/client";

const baseInvitationInput = {
  email: "aday@test.local",
  role: InvitationRole.SUPPLIER_COMPANY,
};

describe("invitation-service", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("rejects a non-platform-admin caller", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);

    await expect(
      invitationService.createInvitation(ctx, baseInvitationInput)
    ).rejects.toThrow(UnauthorizedError);
  });

  it("creates an invitation with a token and a 7-day expiry", async () => {
    const ctx = await createPlatformAdminContext();
    companyIds.push(ctx.companyId);

    const before = Date.now();
    const invitation = await invitationService.createInvitation(ctx, {
      email: "yeni-tedarikci@test.local",
      role: InvitationRole.SUPPLIER_COMPANY,
    });

    expect(invitation.token).toHaveLength(43); // 32 random bytes, base64url
    expect(invitation.status).toBe(InvitationStatus.PENDING);
    const daysUntilExpiry =
      (invitation.expiresAt.getTime() - before) / (24 * 60 * 60 * 1000);
    expect(daysUntilExpiry).toBeGreaterThan(6.9);
    expect(daysUntilExpiry).toBeLessThan(7.1);
  });

  it("rejects an email already used by an existing User", async () => {
    const ctx = await createPlatformAdminContext();
    companyIds.push(ctx.companyId);
    const existingUser = await createTestUser(ctx.companyId);

    await expect(
      invitationService.createInvitation(ctx, {
        email: existingUser.email,
        role: InvitationRole.CUSTOMER_COMPANY,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a second invitation while one is still pending for the same email", async () => {
    const ctx = await createPlatformAdminContext();
    companyIds.push(ctx.companyId);
    const email = "cift-davet@test.local";
    await invitationService.createInvitation(ctx, {
      email,
      role: InvitationRole.SUPPLIER_COMPANY,
    });

    await expect(
      invitationService.createInvitation(ctx, {
        email,
        role: InvitationRole.CUSTOMER_COMPANY,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("only lets a platform admin list or revoke invitations", async () => {
    const adminCtx = await createPlatformAdminContext();
    const plainCtx = await createCustomerContext();
    companyIds.push(adminCtx.companyId, plainCtx.companyId);
    const invitation = await invitationService.createInvitation(adminCtx, {
      email: "sadece-admin@test.local",
      role: InvitationRole.SUPPLIER_COMPANY,
    });

    await expect(invitationService.listInvitations(plainCtx)).rejects.toThrow(
      UnauthorizedError
    );
    await expect(
      invitationService.revokeInvitation(plainCtx, invitation.id)
    ).rejects.toThrow(UnauthorizedError);

    const list = await invitationService.listInvitations(adminCtx);
    expect(list.some((i) => i.id === invitation.id)).toBe(true);
  });

  it("revokes a pending invitation and rejects revoking it twice", async () => {
    const ctx = await createPlatformAdminContext();
    companyIds.push(ctx.companyId);
    const invitation = await invitationService.createInvitation(ctx, {
      email: "iptal-edilecek@test.local",
      role: InvitationRole.SUPPLIER_COMPANY,
    });

    await invitationService.revokeInvitation(ctx, invitation.id);
    const revoked = await invitationService.getInvitationByToken(invitation.token);
    expect(revoked?.status).toBe(InvitationStatus.REVOKED);

    await expect(
      invitationService.revokeInvitation(ctx, invitation.id)
    ).rejects.toThrow(ValidationError);
  });

  it("accepts a pending invitation, creating the Company + first admin User atomically", async () => {
    const ctx = await createPlatformAdminContext();
    companyIds.push(ctx.companyId);
    const invitation = await invitationService.createInvitation(ctx, {
      email: "kabul-edecek@test.local",
      role: InvitationRole.CUSTOMER_COMPANY,
    });

    const result = await invitationService.acceptInvitation(invitation.token, {
      companyName: "Yeni Müşteri A.Ş.",
      fullName: "Yeni Kullanıcı",
      password: "SuperSecret1!",
    });
    expect(result.email).toBe(invitation.email);

    const createdUser = await prisma.user.findUniqueOrThrow({
      where: { email: invitation.email },
      include: { company: true },
    });
    companyIds.push(createdUser.companyId);
    expect(createdUser.company.name).toBe("Yeni Müşteri A.Ş.");
    expect(createdUser.company.type).toBe(CompanyType.CUSTOMER);
    expect(createdUser.fullName).toBe("Yeni Kullanıcı");
    expect(await compare("SuperSecret1!", createdUser.passwordHash)).toBe(true);

    const accepted = await invitationService.getInvitationByToken(invitation.token);
    expect(accepted?.status).toBe(InvitationStatus.ACCEPTED);
    expect(accepted?.acceptedAt).not.toBeNull();
  });

  it("rejects accepting an unknown token", async () => {
    await expect(
      invitationService.acceptInvitation("not-a-real-token", {
        companyName: "X",
        fullName: "Y",
        password: "SuperSecret1!",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects accepting an already-accepted invitation", async () => {
    const ctx = await createPlatformAdminContext();
    companyIds.push(ctx.companyId);
    const invitation = await invitationService.createInvitation(ctx, {
      email: "iki-kere@test.local",
      role: InvitationRole.SUPPLIER_COMPANY,
    });
    const first = await invitationService.acceptInvitation(invitation.token, {
      companyName: "İlk Firma",
      fullName: "İlk Kullanıcı",
      password: "SuperSecret1!",
    });
    const firstUser = await prisma.user.findUniqueOrThrow({
      where: { email: first.email },
    });
    companyIds.push(firstUser.companyId);

    await expect(
      invitationService.acceptInvitation(invitation.token, {
        companyName: "İkinci Firma",
        fullName: "İkinci Kullanıcı",
        password: "SuperSecret1!",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects accepting a revoked invitation", async () => {
    const ctx = await createPlatformAdminContext();
    companyIds.push(ctx.companyId);
    const invitation = await invitationService.createInvitation(ctx, {
      email: "revoked-once@test.local",
      role: InvitationRole.SUPPLIER_COMPANY,
    });
    await invitationService.revokeInvitation(ctx, invitation.id);

    await expect(
      invitationService.acceptInvitation(invitation.token, {
        companyName: "X",
        fullName: "Y",
        password: "SuperSecret1!",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects accepting an expired invitation", async () => {
    const ctx = await createPlatformAdminContext();
    companyIds.push(ctx.companyId);
    const invitation = await invitationService.createInvitation(ctx, {
      email: "expired@test.local",
      role: InvitationRole.SUPPLIER_COMPANY,
    });
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(
      invitationService.acceptInvitation(invitation.token, {
        companyName: "X",
        fullName: "Y",
        password: "SuperSecret1!",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a non-platform-admin caller creating an account directly", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);

    await expect(
      invitationService.createAccountDirectly(ctx, {
        email: "dogrudan@test.local",
        role: InvitationRole.SUPPLIER_COMPANY,
        companyName: "Doğrudan Firma",
        fullName: "Doğrudan Kullanıcı",
        password: "SuperSecret1!",
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it("creates a Company + admin User directly, with no link involved, and lists it as already accepted", async () => {
    const ctx = await createPlatformAdminContext();
    companyIds.push(ctx.companyId);

    const result = await invitationService.createAccountDirectly(ctx, {
      email: "dogrudan-hesap@test.local",
      role: InvitationRole.CUSTOMER_COMPANY,
      companyName: "Doğrudan Müşteri A.Ş.",
      fullName: "Doğrudan Kullanıcı",
      password: "SuperSecret1!",
    });
    expect(result.email).toBe("dogrudan-hesap@test.local");

    const createdUser = await prisma.user.findUniqueOrThrow({
      where: { email: "dogrudan-hesap@test.local" },
      include: { company: true },
    });
    companyIds.push(createdUser.companyId);
    expect(createdUser.company.name).toBe("Doğrudan Müşteri A.Ş.");
    expect(createdUser.company.type).toBe(CompanyType.CUSTOMER);
    expect(await compare("SuperSecret1!", createdUser.passwordHash)).toBe(true);

    const list = await invitationService.listInvitations(ctx);
    const record = list.find((i) => i.email === "dogrudan-hesap@test.local");
    expect(record?.status).toBe(InvitationStatus.ACCEPTED);
    expect(record?.acceptedAt).not.toBeNull();
  });

  it("rejects creating a direct account for an email already in use", async () => {
    const ctx = await createPlatformAdminContext();
    companyIds.push(ctx.companyId);
    const existingUser = await createTestUser(ctx.companyId);

    await expect(
      invitationService.createAccountDirectly(ctx, {
        email: existingUser.email,
        role: InvitationRole.SUPPLIER_COMPANY,
        companyName: "Herhangi Firma",
        fullName: "Herhangi Kullanıcı",
        password: "SuperSecret1!",
      })
    ).rejects.toThrow(ValidationError);
  });
});
