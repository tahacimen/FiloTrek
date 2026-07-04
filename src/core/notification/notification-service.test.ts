import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import * as notificationService from "@/core/notification/notification-service";
import * as emailService from "@/core/notification/email-service";
import { NotFoundError } from "@/core/shared/errors";
import {
  cleanupCompanies,
  createCustomerContext,
  createSupplierContext,
} from "@/test/fixtures";

/** relatedShipmentId has a real FK constraint, so notification tests need an
 * actual Shipment row to point at, not a random id. */
async function createTestShipmentFor(supplierCompanyId: string) {
  const customer = await createCustomerContext();
  const shipment = await prisma.shipment.create({
    data: {
      customerCompanyId: customer.companyId,
      supplierCompanyId,
      originAddress: "A",
      destinationAddress: "B",
      distanceKm: 100,
      tonnage: 5,
      status: "PENDING",
    },
  });
  return { shipment, customerCompanyId: customer.companyId };
}

describe("notification-service", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("lists recent notifications and unread count for the caller's own company", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const { shipment, customerCompanyId } = await createTestShipmentFor(
      ctx.companyId
    );
    companyIds.push(customerCompanyId);

    await notificationService.notifyShipmentRequested({
      supplierCompanyId: ctx.companyId,
      customerCompanyName: "Test Müşteri A.Ş.",
      shipment,
    });

    const { notifications, unreadCount } =
      await notificationService.listRecentNotifications(ctx);
    expect(notifications).toHaveLength(1);
    expect(unreadCount).toBe(1);
    expect(notifications[0].message).toContain("Test Müşteri A.Ş.");
  });

  it("never returns another company's notifications (tenant isolation)", async () => {
    const ctxA = await createSupplierContext();
    const ctxB = await createSupplierContext();
    companyIds.push(ctxA.companyId, ctxB.companyId);
    const { shipment, customerCompanyId } = await createTestShipmentFor(
      ctxA.companyId
    );
    companyIds.push(customerCompanyId);

    await notificationService.notifyShipmentRequested({
      supplierCompanyId: ctxA.companyId,
      customerCompanyName: "Müşteri X",
      shipment,
    });

    const feedForA = await notificationService.listRecentNotifications(ctxA);
    const feedForB = await notificationService.listRecentNotifications(ctxB);
    expect(feedForA.notifications).toHaveLength(1);
    expect(feedForB.notifications).toHaveLength(0);
    expect(feedForB.unreadCount).toBe(0);
  });

  it("markAsRead marks a single notification read and decrements unread count", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const { shipment, customerCompanyId } = await createTestShipmentFor(
      ctx.companyId
    );
    companyIds.push(customerCompanyId);

    await notificationService.notifyShipmentRequested({
      supplierCompanyId: ctx.companyId,
      customerCompanyName: "Müşteri Y",
      shipment,
    });
    const before = await notificationService.listRecentNotifications(ctx);
    expect(before.unreadCount).toBe(1);

    const updated = await notificationService.markAsRead(
      ctx,
      before.notifications[0].id
    );
    expect(updated.isRead).toBe(true);

    const after = await notificationService.listRecentNotifications(ctx);
    expect(after.unreadCount).toBe(0);
  });

  it("markAsRead throws NotFoundError for another company's notification", async () => {
    const ctxA = await createSupplierContext();
    const ctxB = await createSupplierContext();
    companyIds.push(ctxA.companyId, ctxB.companyId);
    const { shipment, customerCompanyId } = await createTestShipmentFor(
      ctxA.companyId
    );
    companyIds.push(customerCompanyId);

    await notificationService.notifyShipmentRequested({
      supplierCompanyId: ctxA.companyId,
      customerCompanyName: "Müşteri Z",
      shipment,
    });
    const { notifications } = await notificationService.listRecentNotifications(
      ctxA
    );

    await expect(
      notificationService.markAsRead(ctxB, notifications[0].id)
    ).rejects.toThrow(NotFoundError);
  });

  it("markAllAsRead clears the unread count for the whole company", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const shipment1 = await createTestShipmentFor(ctx.companyId);
    const shipment2 = await createTestShipmentFor(ctx.companyId);
    companyIds.push(shipment1.customerCompanyId, shipment2.customerCompanyId);

    await Promise.all([
      notificationService.notifyShipmentRequested({
        supplierCompanyId: ctx.companyId,
        customerCompanyName: "Müşteri 1",
        shipment: shipment1.shipment,
      }),
      notificationService.notifyShipmentRequested({
        supplierCompanyId: ctx.companyId,
        customerCompanyName: "Müşteri 2",
        shipment: shipment2.shipment,
      }),
    ]);
    expect((await notificationService.listRecentNotifications(ctx)).unreadCount).toBe(2);

    await notificationService.markAllAsRead(ctx);

    expect((await notificationService.listRecentNotifications(ctx)).unreadCount).toBe(0);
  });
});

describe("email hooks", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * emailCompanyBestEffort catches its own failures, so leaving the spy
   * unmocked (real sendEmailToCompany, no SMTP_HOST in .env.test) would
   * still pass these — mocking it out is what actually proves the hook
   * fired, not just that the surrounding notification call didn't throw.
   */
  function spyOnEmail() {
    return vi.spyOn(emailService, "sendEmailToCompany").mockResolvedValue();
  }

  it("notifyPriceProposed also emails the customer company", async () => {
    const emailSpy = spyOnEmail();
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const { shipment, customerCompanyId } = await createTestShipmentFor(
      ctx.companyId
    );
    companyIds.push(customerCompanyId);

    await notificationService.notifyPriceProposed({
      recipientCompanyId: customerCompanyId,
      proposerCompanyName: "Test Tedarikçi",
      amount: 15000,
      shipment,
    });

    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy).toHaveBeenCalledWith(
      customerCompanyId,
      expect.any(String),
      expect.any(String)
    );
  });

  it("notifyDriverCompletedDelivery emails both the customer and supplier", async () => {
    const emailSpy = spyOnEmail();
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const { shipment, customerCompanyId } = await createTestShipmentFor(
      ctx.companyId
    );
    companyIds.push(customerCompanyId);

    await notificationService.notifyDriverCompletedDelivery({
      customerCompanyId,
      customerCompanyName: "Test Müşteri",
      supplierCompanyId: ctx.companyId,
      supplierCompanyName: "Test Tedarikçi",
      driverName: "Test Şoför",
      shipment,
    });

    expect(emailSpy).toHaveBeenCalledTimes(2);
    const notifiedCompanyIds = emailSpy.mock.calls.map((call) => call[0]);
    expect(notifiedCompanyIds.sort()).toEqual(
      [customerCompanyId, ctx.companyId].sort()
    );
  });

  it("notifyIncidentReported emails both the customer and supplier", async () => {
    const emailSpy = spyOnEmail();
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const { shipment, customerCompanyId } = await createTestShipmentFor(
      ctx.companyId
    );
    companyIds.push(customerCompanyId);

    await notificationService.notifyIncidentReported({
      customerCompanyId,
      customerCompanyName: "Test Müşteri",
      supplierCompanyId: ctx.companyId,
      supplierCompanyName: "Test Tedarikçi",
      actorName: "Test Şoför",
      shipment,
    });

    expect(emailSpy).toHaveBeenCalledTimes(2);
  });

  it("notification types outside the three hooked functions never trigger an email", async () => {
    const emailSpy = spyOnEmail();
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const { shipment, customerCompanyId } = await createTestShipmentFor(
      ctx.companyId
    );
    companyIds.push(customerCompanyId);

    await notificationService.notifyShipmentRequested({
      supplierCompanyId: ctx.companyId,
      customerCompanyName: "Test Müşteri",
      shipment,
    });
    await notificationService.notifyLoadReady({
      supplierCompanyId: ctx.companyId,
      customerCompanyName: "Test Müşteri",
      shipment,
    });
    await notificationService.notifyVehicleDeparted({
      customerCompanyId,
      supplierCompanyName: "Test Tedarikçi",
      shipment,
    });
    await notificationService.notifyPriceApproved({
      recipientCompanyId: ctx.companyId,
      recipientRole: "SUPPLIER",
      accepterCompanyName: "Test Müşteri",
      shipment,
    });
    await notificationService.notifyPriceRejected({
      recipientCompanyId: ctx.companyId,
      rejecterCompanyName: "Test Müşteri",
      shipment,
    });
    await notificationService.notifyDriverArrivedPickup({
      customerCompanyId,
      customerCompanyName: "Test Müşteri",
      supplierCompanyId: ctx.companyId,
      supplierCompanyName: "Test Tedarikçi",
      driverName: "Test Şoför",
      shipment,
    });
    await notificationService.notifyDriverAtPickupGate({
      customerCompanyId,
      customerCompanyName: "Test Müşteri",
      supplierCompanyId: ctx.companyId,
      supplierCompanyName: "Test Tedarikçi",
      driverName: "Test Şoför",
      shipment,
    });
    await notificationService.notifyIncidentResolved({
      customerCompanyId,
      customerCompanyName: "Test Müşteri",
      supplierCompanyId: ctx.companyId,
      supplierCompanyName: "Test Tedarikçi",
      actorName: "Test Şoför",
      shipment,
    });

    expect(emailSpy).not.toHaveBeenCalled();
  });

  it("notifyDriverLoginLink emails the driver directly with the link", async () => {
    const sendEmailSpy = vi.spyOn(emailService, "sendEmail").mockResolvedValue();

    await notificationService.notifyDriverLoginLink({
      driverEmail: "driver@test.local",
      driverFullName: "Test Şoför",
      loginUrl: "https://fleetlink.test/api/driver-login/abc123",
    });

    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "driver@test.local",
        text: expect.stringContaining("https://fleetlink.test/api/driver-login/abc123"),
      })
    );
  });

  /**
   * Unlike the other notifications in this file (which swallow email
   * failures — see emailCompanyBestEffort), sending the email here IS the
   * point of the calling action, so a real failure must propagate instead
   * of vanishing silently.
   */
  it("notifyDriverLoginLink propagates a send failure instead of swallowing it", async () => {
    vi.spyOn(emailService, "sendEmail").mockRejectedValue(
      new Error("SMTP unreachable")
    );

    await expect(
      notificationService.notifyDriverLoginLink({
        driverEmail: "driver@test.local",
        driverFullName: "Test Şoför",
        loginUrl: "https://fleetlink.test/api/driver-login/abc123",
      })
    ).rejects.toThrow("SMTP unreachable");
  });
});
