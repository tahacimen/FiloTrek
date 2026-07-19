import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import * as signupService from "@/core/signup/signup-service";
import {
  cleanupCompanies,
  createPlatformAdminContext,
  createSupplierContext,
} from "@/test/fixtures";

const createdEmails: string[] = [];

async function cleanupSignups() {
  if (createdEmails.length === 0) return;
  await prisma.signupRequest.deleteMany({
    where: { email: { in: createdEmails } },
  });
  createdEmails.length = 0;
}

function uniqueEmail() {
  const email = `applicant-${crypto.randomUUID().slice(0, 8)}@yeni-firma.com`;
  createdEmails.push(email);
  return email;
}

describe("createSignupRequest", () => {
  afterEach(cleanupSignups);

  it("records the request and notifies every platform admin's company", async () => {
    const adminCtx = await createPlatformAdminContext();
    try {
      const email = uniqueEmail();
      const { id } = await signupService.createSignupRequest({
        companyName: "Yeni Lojistik A.Ş.",
        fullName: "Aday Kişi",
        email,
        phone: "0500 111 22 33",
        role: "SUPPLIER_COMPANY",
        message: "Filomu sisteme eklemek istiyorum.",
      });

      const saved = await prisma.signupRequest.findUnique({ where: { id } });
      expect(saved).not.toBeNull();
      expect(saved!.status).toBe("PENDING");
      expect(saved!.companyName).toBe("Yeni Lojistik A.Ş.");

      const notifications = await prisma.notification.findMany({
        where: { companyId: adminCtx.companyId, type: "SIGNUP_REQUESTED" },
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toContain(email);
    } finally {
      await cleanupCompanies([adminCtx.companyId]);
    }
  });

  it("rejects an email that already belongs to an account", async () => {
    const supplierCtx = await createSupplierContext();
    try {
      const user = await prisma.user.findFirstOrThrow({
        where: { companyId: supplierCtx.companyId },
      });
      await expect(
        signupService.createSignupRequest({
          companyName: "Kopya Firma",
          fullName: "Kopya Kişi",
          email: user.email,
          role: "CUSTOMER_COMPANY",
        })
      ).rejects.toThrow(/zaten bir hesap/);
    } finally {
      await cleanupCompanies([supplierCtx.companyId]);
    }
  });

  it("rejects a second pending request for the same email", async () => {
    const email = uniqueEmail();
    const input = {
      companyName: "Bir Firma",
      fullName: "Bir Kişi",
      email,
      role: "CUSTOMER_COMPANY" as const,
    };
    await signupService.createSignupRequest(input);
    await expect(signupService.createSignupRequest(input)).rejects.toThrow(
      /bekleyen bir kayıt talebi/
    );
  });

  it("blocks listing for a non-platform-admin", async () => {
    const supplierCtx = await createSupplierContext();
    try {
      await expect(
        signupService.listSignupRequests(supplierCtx)
      ).rejects.toThrow();
    } finally {
      await cleanupCompanies([supplierCtx.companyId]);
    }
  });
});

describe("approveSignupRequestAndCreateAccount", () => {
  afterEach(cleanupSignups);

  it("creates the account, marks the request APPROVED, and returns credentials", async () => {
    const adminCtx = await createPlatformAdminContext();
    const cleanupIds = [adminCtx.companyId];
    try {
      const email = uniqueEmail();
      const { id } = await signupService.createSignupRequest({
        companyName: "Onay Test Lojistik",
        fullName: "Onay Kişi",
        email,
        role: "SUPPLIER_COMPANY",
      });

      const result = await signupService.approveSignupRequestAndCreateAccount(
        adminCtx,
        id,
        "GucluSifre123"
      );
      expect(result.email).toBe(email);
      expect(result.password).toBe("GucluSifre123");

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).not.toBeNull();
      expect(user!.companyRole).toBe("ADMIN");
      cleanupIds.push(user!.companyId);

      const company = await prisma.company.findUnique({
        where: { id: user!.companyId },
      });
      expect(company!.type).toBe("SUPPLIER");

      const saved = await prisma.signupRequest.findUnique({ where: { id } });
      expect(saved!.status).toBe("APPROVED");
    } finally {
      await cleanupCompanies(cleanupIds);
    }
  });

  it("rejects a password shorter than 8 characters", async () => {
    const adminCtx = await createPlatformAdminContext();
    try {
      const { id } = await signupService.createSignupRequest({
        companyName: "Kısa Şifre Firma",
        fullName: "Kişi",
        email: uniqueEmail(),
        role: "CUSTOMER_COMPANY",
      });
      await expect(
        signupService.approveSignupRequestAndCreateAccount(adminCtx, id, "kısa")
      ).rejects.toThrow(/en az 8/);
    } finally {
      await cleanupCompanies([adminCtx.companyId]);
    }
  });

  it("rejects approving an already-handled request", async () => {
    const adminCtx = await createPlatformAdminContext();
    const cleanupIds = [adminCtx.companyId];
    try {
      const { id } = await signupService.createSignupRequest({
        companyName: "İkinci Onay Firma",
        fullName: "Kişi",
        email: uniqueEmail(),
        role: "CUSTOMER_COMPANY",
      });
      const first = await signupService.approveSignupRequestAndCreateAccount(
        adminCtx,
        id,
        "GucluSifre123"
      );
      const created = await prisma.user.findUnique({
        where: { email: first.email },
      });
      cleanupIds.push(created!.companyId);

      await expect(
        signupService.approveSignupRequestAndCreateAccount(
          adminCtx,
          id,
          "BaskaSifre123"
        )
      ).rejects.toThrow(/zaten işleme/);
    } finally {
      await cleanupCompanies(cleanupIds);
    }
  });
});
