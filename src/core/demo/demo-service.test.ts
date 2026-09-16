import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import * as demoService from "@/core/demo/demo-service";
import {
  cleanupCompanies,
  createPlatformAdminContext,
  createSupplierContext,
} from "@/test/fixtures";

const createdEmails: string[] = [];

async function cleanupDemos() {
  if (createdEmails.length === 0) return;
  await prisma.demoRequest.deleteMany({
    where: { email: { in: createdEmails } },
  });
  createdEmails.length = 0;
}

function uniqueEmail() {
  const email = `demo-${crypto.randomUUID().slice(0, 8)}@yeni-firma.com`;
  createdEmails.push(email);
  return email;
}

describe("createDemoRequest", () => {
  afterEach(cleanupDemos);

  it("records a demo lead (no account is created)", async () => {
    const email = uniqueEmail();
    const { id } = await demoService.createDemoRequest({
      companyName: "Deneme Nakliyat",
      fullName: "Talep Sahibi",
      email,
      phone: "0500 111 22 33",
      vehicleCount: "12",
      message: "Demo görmek istiyorum.",
    });

    const saved = await prisma.demoRequest.findUnique({ where: { id } });
    expect(saved).not.toBeNull();
    expect(saved!.status).toBe("NEW");
    expect(saved!.vehicleCount).toBe(12);
    expect(saved!.companyName).toBe("Deneme Nakliyat");

    // A demo request must never create a user/account.
    const user = await prisma.user.findFirst({ where: { email } });
    expect(user).toBeNull();
  });

  it("rejects invalid input (missing vehicle count)", async () => {
    await expect(
      demoService.createDemoRequest({
        companyName: "X",
        fullName: "Y",
        email: uniqueEmail(),
        phone: "0500 111 22 33",
        vehicleCount: "",
        message: "",
      })
    ).rejects.toThrow();
  });
});

describe("demo request admin actions", () => {
  afterEach(cleanupDemos);

  it("toggles status for a platform admin", async () => {
    const adminCtx = await createPlatformAdminContext();
    try {
      const { id } = await demoService.createDemoRequest({
        companyName: "Durum Test",
        fullName: "Kişi",
        email: uniqueEmail(),
        phone: "0500 000 00 00",
        vehicleCount: "3",
      });
      const updated = await demoService.setDemoRequestStatus(
        adminCtx,
        id,
        "CONTACTED"
      );
      expect(updated.status).toBe("CONTACTED");
    } finally {
      await cleanupCompanies([adminCtx.companyId]);
    }
  });

  it("blocks listing/updating for a non-platform-admin", async () => {
    const supplierCtx = await createSupplierContext();
    try {
      await expect(demoService.listDemoRequests(supplierCtx)).rejects.toThrow();
    } finally {
      await cleanupCompanies([supplierCtx.companyId]);
    }
  });
});
