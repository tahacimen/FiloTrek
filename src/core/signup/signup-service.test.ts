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
