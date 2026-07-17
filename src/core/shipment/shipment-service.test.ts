import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import * as shipmentService from "@/core/shipment/shipment-service";
import {
  advanceShipmentStatus,
  advanceShipmentStatusAsDriver,
  assignVehicleAndDriver,
} from "@/core/shipment/shipment-status";
import * as emailService from "@/core/notification/email-service";
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/core/shared/errors";
import {
  cleanupCompanies,
  createCustomerContext,
  createSupplierContext,
  createTestDriver,
  createTestPhotoFile,
  createTestVehicle,
} from "@/test/fixtures";
import type { DriverContext } from "@/core/shared/driver-context";

const baseFields = {
  originAddress: "İstanbul",
  destinationAddress: "Ankara",
  distanceKm: "450",
  tonnage: "8",
};

/** Shared by the markLoadReady and approvePrice suites, which each need their own ASSIGNED fixture. */
async function setupAssignedShipment(companyIds: string[]) {
  const customerCtx = await createCustomerContext();
  const supplierCtx = await createSupplierContext();
  companyIds.push(customerCtx.companyId, supplierCtx.companyId);

  const vehicle = await createTestVehicle(supplierCtx.companyId);
  const driver = await createTestDriver(supplierCtx.companyId);
  const shipment = await shipmentService.createShipmentRequest(customerCtx, {
    ...baseFields,
    supplierCompanyId: supplierCtx.companyId,
  });
  await assignVehicleAndDriver(supplierCtx, {
    shipmentId: shipment.id,
    vehicleId: vehicle.id,
    driverId: driver.id,
    agreedPrice: 15000,
  });

  return { customerCtx, supplierCtx, shipmentId: shipment.id };
}

describe("shipment-service: creation (supplier + customer branches)", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("createShipment: supplier creates a shipment for a chosen customer, sides not swapped", async () => {
    const supplierCtx = await createSupplierContext();
    const customerCtx = await createCustomerContext();
    companyIds.push(supplierCtx.companyId, customerCtx.companyId);

    const shipment = await shipmentService.createShipment(supplierCtx, {
      ...baseFields,
      customerCompanyId: customerCtx.companyId,
    });

    expect(shipment.supplierCompanyId).toBe(supplierCtx.companyId);
    expect(shipment.customerCompanyId).toBe(customerCtx.companyId);
    expect(shipment.status).toBe("PENDING");
  });

  it("createShipment: rejects a CUSTOMER-role caller", async () => {
    const customerCtx = await createCustomerContext();
    const otherCustomerCtx = await createCustomerContext();
    companyIds.push(customerCtx.companyId, otherCustomerCtx.companyId);

    await expect(
      shipmentService.createShipment(customerCtx, {
        ...baseFields,
        customerCompanyId: otherCustomerCtx.companyId,
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it("createShipment: rejects picking a non-customer (e.g. another supplier) as the counterparty", async () => {
    const supplierCtx = await createSupplierContext();
    const otherSupplierCtx = await createSupplierContext();
    companyIds.push(supplierCtx.companyId, otherSupplierCtx.companyId);

    await expect(
      shipmentService.createShipment(supplierCtx, {
        ...baseFields,
        customerCompanyId: otherSupplierCtx.companyId,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("createShipmentRequest: customer requests a vehicle from a chosen supplier, sides not swapped", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
    });

    // The headline tenant-isolation risk: the customer's own company must
    // never end up recorded as the supplier of its own shipment.
    expect(shipment.customerCompanyId).toBe(customerCtx.companyId);
    expect(shipment.supplierCompanyId).toBe(supplierCtx.companyId);
    expect(shipment.customerCompanyId).not.toBe(shipment.supplierCompanyId);
    expect(shipment.status).toBe("PENDING");
  });

  it("createShipmentRequest: stores an optional documentTrackingNumber", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
      documentTrackingNumber: "IRS-2026-00001",
    });

    expect(shipment.documentTrackingNumber).toBe("IRS-2026-00001");
  });

  it("createShipmentRequest: stores the Kapı Rezervasyonu origin/destination maps links", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
      originMapsUrl: "https://maps.google.com/?q=41.0,29.0",
      destinationMapsUrl: "https://maps.google.com/?q=39.9,32.8",
    });

    expect(shipment.originMapsUrl).toBe("https://maps.google.com/?q=41.0,29.0");
    expect(shipment.destinationMapsUrl).toBe(
      "https://maps.google.com/?q=39.9,32.8"
    );
  });

  it("createShipmentRequest: leaves the maps links null when not provided", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
    });

    expect(shipment.originMapsUrl).toBeNull();
    expect(shipment.destinationMapsUrl).toBeNull();
  });

  it("createShipmentRequest: rejects a non-http(s) maps link (e.g. javascript:)", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    await expect(
      shipmentService.createShipmentRequest(customerCtx, {
        ...baseFields,
        supplierCompanyId: supplierCtx.companyId,
        originMapsUrl: "javascript:alert(1)",
      })
    ).rejects.toThrow();
  });

  it("createShipment (supplier-initiated): shipmentInputSchema strips any Kapı Rezervasyonu link, even if supplied — they stay null", async () => {
    const supplierCtx = await createSupplierContext();
    const customerCtx = await createCustomerContext();
    companyIds.push(supplierCtx.companyId, customerCtx.companyId);

    // createShipment takes `rawInput: unknown` (validated by Zod, not the
    // TS type system) — this proves at runtime that shipmentInputSchema
    // (unlike shipmentRequestInputSchema) has no originMapsUrl field, so it
    // gets silently stripped rather than stored, even if a caller tried to
    // sneak it in.
    const shipment = await shipmentService.createShipment(supplierCtx, {
      ...baseFields,
      customerCompanyId: customerCtx.companyId,
      originMapsUrl: "https://maps.google.com/?q=41.0,29.0",
    });

    expect(shipment.originMapsUrl).toBeNull();
  });

  it("createShipmentRequest: creates a notification for the chosen supplier", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
    });

    const notifications = await prisma.notification.findMany({
      where: { companyId: supplierCtx.companyId },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].relatedShipmentId).toBe(shipment.id);
    expect(notifications[0].type).toBe("SHIPMENT_REQUESTED");
    expect(notifications[0].isRead).toBe(false);

    const customerSideNotifications = await prisma.notification.findMany({
      where: { companyId: customerCtx.companyId },
    });
    expect(customerSideNotifications).toHaveLength(0);
  });

  it("createShipmentRequest: rejects a SUPPLIER-role caller", async () => {
    const supplierCtx = await createSupplierContext();
    const otherSupplierCtx = await createSupplierContext();
    companyIds.push(supplierCtx.companyId, otherSupplierCtx.companyId);

    await expect(
      shipmentService.createShipmentRequest(supplierCtx, {
        ...baseFields,
        supplierCompanyId: otherSupplierCtx.companyId,
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it("createShipmentRequest: rejects picking a non-supplier (e.g. another customer) as the counterparty", async () => {
    const customerCtx = await createCustomerContext();
    const otherCustomerCtx = await createCustomerContext();
    companyIds.push(customerCtx.companyId, otherCustomerCtx.companyId);

    await expect(
      shipmentService.createShipmentRequest(customerCtx, {
        ...baseFields,
        supplierCompanyId: otherCustomerCtx.companyId,
      })
    ).rejects.toThrow(ValidationError);
  });
});

describe("shipment-service: markLoadReady", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emails the assigned driver directly with the pickup navigation link", async () => {
    const emailSpy = vi.spyOn(emailService, "sendEmail").mockResolvedValue();
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);
    const vehicle = await createTestVehicle(supplierCtx.companyId);
    const driver = await createTestDriver(supplierCtx.companyId, {
      email: "driver-load-ready@test.local",
    });
    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
    });
    await assignVehicleAndDriver(supplierCtx, {
      shipmentId: shipment.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      agreedPrice: 15000,
    });

    await shipmentService.markLoadReady(customerCtx, shipment.id, {
      pickupGateInfo: "B Kapısı, 4 No'lu Rampa",
      pickupMapsUrl: "https://maps.google.com/?q=41.0,29.0",
    });

    expect(emailSpy).toHaveBeenCalledTimes(1);
    const [call] = emailSpy.mock.calls;
    expect(call[0].to).toBe("driver-load-ready@test.local");
    expect(call[0].text).toContain("https://maps.google.com/?q=41.0,29.0");
    expect(call[0].text).toContain("B Kapısı, 4 No'lu Rampa");
  });

  it("does not attempt an email when the driver has no login/email set", async () => {
    const emailSpy = vi.spyOn(emailService, "sendEmail").mockResolvedValue();
    const { customerCtx, shipmentId } = await setupAssignedShipment(companyIds);

    await shipmentService.markLoadReady(customerCtx, shipmentId, {
      pickupGateInfo: "B Kapısı",
    });

    expect(emailSpy).not.toHaveBeenCalled();
  });

  it("marks a shipment load-ready with gate info and a maps link, notifying the supplier", async () => {
    const { customerCtx, supplierCtx, shipmentId } =
      await setupAssignedShipment(companyIds);

    const updated = await shipmentService.markLoadReady(customerCtx, shipmentId, {
      pickupGateInfo: "B Kapısı, 4 No'lu Rampa",
      pickupMapsUrl: "https://maps.google.com/?q=41.0,29.0",
    });

    expect(updated.pickupGateInfo).toBe("B Kapısı, 4 No'lu Rampa");
    expect(updated.pickupMapsUrl).toBe("https://maps.google.com/?q=41.0,29.0");
    expect(updated.loadReadyAt).not.toBeNull();

    const notifications = await prisma.notification.findMany({
      where: { companyId: supplierCtx.companyId },
    });
    const loadReadyNotifications = notifications.filter(
      (n) => n.type === "LOAD_READY"
    );
    expect(loadReadyNotifications).toHaveLength(1);
    expect(loadReadyNotifications[0].relatedShipmentId).toBe(shipmentId);
  });

  it("marks load-ready without a maps link (optional)", async () => {
    const { customerCtx, shipmentId } = await setupAssignedShipment(companyIds);

    const updated = await shipmentService.markLoadReady(customerCtx, shipmentId, {
      pickupGateInfo: "Ana Kapı",
    });

    expect(updated.pickupGateInfo).toBe("Ana Kapı");
    expect(updated.pickupMapsUrl).toBeNull();
  });

  it("allows resubmission while still ASSIGNED, overwriting the previous values", async () => {
    const { customerCtx, shipmentId } = await setupAssignedShipment(companyIds);

    await shipmentService.markLoadReady(customerCtx, shipmentId, {
      pickupGateInfo: "Yanlış Kapı",
      pickupMapsUrl: "https://maps.google.com/?q=1,1",
    });
    const corrected = await shipmentService.markLoadReady(
      customerCtx,
      shipmentId,
      { pickupGateInfo: "Doğru Kapı" }
    );

    expect(corrected.pickupGateInfo).toBe("Doğru Kapı");
    // Omitting the maps link on resubmission clears the previous value
    // rather than leaving the stale one in place.
    expect(corrected.pickupMapsUrl).toBeNull();
  });

  it("rejects a SUPPLIER-role caller", async () => {
    const { supplierCtx, shipmentId } = await setupAssignedShipment(companyIds);

    await expect(
      shipmentService.markLoadReady(supplierCtx, shipmentId, {
        pickupGateInfo: "B Kapısı",
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it("rejects a customer that doesn't own the shipment", async () => {
    const { shipmentId } = await setupAssignedShipment(companyIds);
    const otherCustomerCtx = await createCustomerContext();
    companyIds.push(otherCustomerCtx.companyId);

    await expect(
      shipmentService.markLoadReady(otherCustomerCtx, shipmentId, {
        pickupGateInfo: "B Kapısı",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects when the shipment isn't ASSIGNED yet (still PENDING)", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
    });

    await expect(
      shipmentService.markLoadReady(customerCtx, shipment.id, {
        pickupGateInfo: "B Kapısı",
      })
    ).rejects.toThrow(ValidationError);
  });
});

describe("shipment-service: setPickupEta", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("sets the estimated pickup arrival while ASSIGNED", async () => {
    const { supplierCtx, shipmentId } = await setupAssignedShipment(companyIds);
    const eta = new Date("2026-07-10T09:30:00");

    const updated = await shipmentService.setPickupEta(supplierCtx, shipmentId, {
      estimatedPickupArrivalAt: eta,
    });

    expect(updated!.estimatedPickupArrivalAt?.getTime()).toBe(eta.getTime());
  });

  it("allows updating the estimate (delay correction) while still HEADING_TO_PICKUP", async () => {
    const { customerCtx, supplierCtx, shipmentId } =
      await setupAssignedShipment(companyIds);
    await shipmentService.approvePrice(customerCtx, shipmentId);
    await advanceShipmentStatus(
      supplierCtx,
      { shipmentId, targetStatus: "HEADING_TO_PICKUP" as const },
    );

    const firstEta = new Date("2026-07-10T09:30:00");
    const delayedEta = new Date("2026-07-10T11:00:00");
    await shipmentService.setPickupEta(supplierCtx, shipmentId, {
      estimatedPickupArrivalAt: firstEta,
    });
    const updated = await shipmentService.setPickupEta(supplierCtx, shipmentId, {
      estimatedPickupArrivalAt: delayedEta,
    });

    expect(updated!.estimatedPickupArrivalAt?.getTime()).toBe(
      delayedEta.getTime()
    );
  });

  it("rejects once the vehicle has already arrived (LOADING or later)", async () => {
    const { customerCtx, supplierCtx, shipmentId } =
      await setupAssignedShipment(companyIds);
    await shipmentService.approvePrice(customerCtx, shipmentId);
    await advanceShipmentStatus(supplierCtx, {
      shipmentId,
      targetStatus: "HEADING_TO_PICKUP" as const,
    });
    await advanceShipmentStatus(supplierCtx, {
      shipmentId,
      targetStatus: "LOADING" as const,
    });

    await expect(
      shipmentService.setPickupEta(supplierCtx, shipmentId, {
        estimatedPickupArrivalAt: new Date("2026-07-10T09:30:00"),
      })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a CUSTOMER-role caller", async () => {
    const { customerCtx, shipmentId } = await setupAssignedShipment(companyIds);

    await expect(
      shipmentService.setPickupEta(customerCtx, shipmentId, {
        estimatedPickupArrivalAt: new Date("2026-07-10T09:30:00"),
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it("rejects an invalid date value", async () => {
    const { supplierCtx, shipmentId } = await setupAssignedShipment(companyIds);

    await expect(
      shipmentService.setPickupEta(supplierCtx, shipmentId, {
        estimatedPickupArrivalAt: "not-a-date",
      })
    ).rejects.toThrow();
  });
});

describe("shipment-service: approvePrice", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("approves the proposed price, notifying the supplier", async () => {
    const { customerCtx, supplierCtx, shipmentId } =
      await setupAssignedShipment(companyIds);

    const updated = await shipmentService.approvePrice(customerCtx, shipmentId);

    expect(updated.priceApprovedAt).not.toBeNull();

    const notifications = await prisma.notification.findMany({
      where: { companyId: supplierCtx.companyId, type: "PRICE_APPROVED" },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].relatedShipmentId).toBe(shipmentId);
  });

  it("is idempotent on a second approval — no duplicate notification", async () => {
    const { customerCtx, supplierCtx, shipmentId } =
      await setupAssignedShipment(companyIds);

    const first = await shipmentService.approvePrice(customerCtx, shipmentId);
    const second = await shipmentService.approvePrice(customerCtx, shipmentId);

    expect(second.priceApprovedAt?.getTime()).toBe(
      first.priceApprovedAt?.getTime()
    );
    const notifications = await prisma.notification.findMany({
      where: { companyId: supplierCtx.companyId, type: "PRICE_APPROVED" },
    });
    expect(notifications).toHaveLength(1);
  });

  it("rejects the proposer trying to approve their own price", async () => {
    const { supplierCtx, shipmentId } = await setupAssignedShipment(companyIds);

    // assignVehicleAndDriver always sets priceProposedBy: SUPPLIER — the
    // supplier approving their own just-proposed price is meaningless.
    await expect(
      shipmentService.approvePrice(supplierCtx, shipmentId)
    ).rejects.toThrow(ValidationError);
  });

  it("lets the supplier accept a customer counter-offer", async () => {
    const { customerCtx, supplierCtx, shipmentId } =
      await setupAssignedShipment(companyIds);
    await shipmentService.rejectPrice(customerCtx, shipmentId, {
      counterAmount: 12000,
    });

    const updated = await shipmentService.approvePrice(supplierCtx, shipmentId);

    expect(updated.priceApprovedAt).not.toBeNull();
    expect(updated.agreedPrice?.toNumber()).toBe(12000);

    const notifications = await prisma.notification.findMany({
      where: { companyId: customerCtx.companyId, type: "PRICE_APPROVED" },
    });
    expect(notifications).toHaveLength(1);
  });

  it("rejects a customer that doesn't own the shipment", async () => {
    const { shipmentId } = await setupAssignedShipment(companyIds);
    const otherCustomerCtx = await createCustomerContext();
    companyIds.push(otherCustomerCtx.companyId);

    await expect(
      shipmentService.approvePrice(otherCustomerCtx, shipmentId)
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects when there is no price to approve yet (still PENDING)", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
    });

    await expect(
      shipmentService.approvePrice(customerCtx, shipment.id)
    ).rejects.toThrow(ValidationError);
  });
});

describe("shipment-service: proposePrice / rejectPrice (negotiation)", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("customer rejects with a counter-offer, flipping priceProposedBy", async () => {
    const { customerCtx, shipmentId } = await setupAssignedShipment(companyIds);

    const updated = await shipmentService.rejectPrice(customerCtx, shipmentId, {
      counterAmount: 12000,
    });

    expect(updated.agreedPrice?.toNumber()).toBe(12000);
    expect(updated.priceProposedBy).toBe("CUSTOMER");
    expect(updated.priceApprovedAt).toBeNull();
    expect(updated.priceRejectedAt).toBeNull();
  });

  it("customer rejects with no counter — agreedPrice stays, priceRejectedAt is set", async () => {
    const { customerCtx, shipmentId } = await setupAssignedShipment(companyIds);

    const updated = await shipmentService.rejectPrice(customerCtx, shipmentId, {});

    expect(updated.agreedPrice?.toNumber()).toBe(15000);
    expect(updated.priceProposedBy).toBe("SUPPLIER");
    expect(updated.priceRejectedAt).not.toBeNull();
  });

  it("supplier proposes a new price after a bare rejection, clearing priceRejectedAt", async () => {
    const { customerCtx, supplierCtx, shipmentId } =
      await setupAssignedShipment(companyIds);
    await shipmentService.rejectPrice(customerCtx, shipmentId, {});

    const updated = await shipmentService.proposePrice(supplierCtx, shipmentId, {
      amount: 16000,
    });

    expect(updated.agreedPrice?.toNumber()).toBe(16000);
    expect(updated.priceProposedBy).toBe("SUPPLIER");
    expect(updated.priceRejectedAt).toBeNull();
  });

  it("supports an unlimited back-and-forth until one side approves", async () => {
    const { customerCtx, supplierCtx, shipmentId } =
      await setupAssignedShipment(companyIds);

    await shipmentService.rejectPrice(customerCtx, shipmentId, {
      counterAmount: 12000,
    });
    await shipmentService.rejectPrice(supplierCtx, shipmentId, {
      counterAmount: 14000,
    });
    await shipmentService.rejectPrice(customerCtx, shipmentId, {
      counterAmount: 13000,
    });
    const final = await shipmentService.approvePrice(supplierCtx, shipmentId);

    expect(final.agreedPrice?.toNumber()).toBe(13000);
    expect(final.priceProposedBy).toBe("CUSTOMER");
    expect(final.priceApprovedAt).not.toBeNull();
  });

  it("rejects the proposer trying to reject/counter their own pending offer", async () => {
    const { supplierCtx, shipmentId } = await setupAssignedShipment(companyIds);

    await expect(
      shipmentService.rejectPrice(supplierCtx, shipmentId, { counterAmount: 9000 })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects proposing once the price is already approved", async () => {
    const { customerCtx, supplierCtx, shipmentId } =
      await setupAssignedShipment(companyIds);
    await shipmentService.approvePrice(customerCtx, shipmentId);

    await expect(
      shipmentService.proposePrice(supplierCtx, shipmentId, { amount: 20000 })
    ).rejects.toThrow(ValidationError);
  });

  it("lets the current proposer revise their own still-pending offer", async () => {
    const { supplierCtx, shipmentId } = await setupAssignedShipment(companyIds);

    const updated = await shipmentService.proposePrice(supplierCtx, shipmentId, {
      amount: 17500,
    });

    expect(updated.agreedPrice?.toNumber()).toBe(17500);
    expect(updated.priceProposedBy).toBe("SUPPLIER");
  });
});

describe("shipment-service: departure/delivery photos", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("keeps the departure and delivery photos distinct — getDeparturePhoto never shadows getDeliveryPhoto's row", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const vehicle = await createTestVehicle(supplierCtx.companyId);
    const driver = await createTestDriver(supplierCtx.companyId);
    const driverCtx: DriverContext = {
      driverId: driver.id,
      companyId: supplierCtx.companyId,
      fullName: driver.fullName,
    };

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
    });
    await assignVehicleAndDriver(supplierCtx, {
      shipmentId: shipment.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      agreedPrice: 15000,
    });
    await shipmentService.approvePrice(customerCtx, shipment.id);
    await advanceShipmentStatus(supplierCtx, {
      shipmentId: shipment.id,
      targetStatus: "HEADING_TO_PICKUP" as const,
    });
    for (const targetStatus of ["LOADING", "AT_PICKUP_GATE"] as const) {
      await advanceShipmentStatusAsDriver(driverCtx, {
        shipmentId: shipment.id,
        targetStatus,
      });
    }
    await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: "EN_ROUTE",
      photo: createTestPhotoFile("departure.jpg"),
    });
    await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: "AT_DELIVERY_POINT",
    });
    await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: "COMPLETED",
      photo: createTestPhotoFile("delivery.jpg"),
    });

    const departurePhoto = await shipmentService.getDeparturePhoto(shipment.id);
    const deliveryPhoto = await shipmentService.getDeliveryPhoto(shipment.id);

    expect(departurePhoto?.photoUrl).toBeTruthy();
    expect(deliveryPhoto?.photoUrl).toBeTruthy();
    expect(departurePhoto?.photoUrl).not.toBe(deliveryPhoto?.photoUrl);
  });
});
