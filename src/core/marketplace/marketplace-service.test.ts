import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import * as shipmentService from "@/core/shipment/shipment-service";
import * as marketplaceService from "@/core/marketplace/marketplace-service";
import { assignVehicleAndDriver } from "@/core/shipment/shipment-status";
import { NotFoundError, UnauthorizedError } from "@/core/shared/errors";
import {
  cleanupCompanies,
  createCustomerContext,
  createSupplierContext,
  createTestDriver,
  createTestVehicle,
} from "@/test/fixtures";

const baseFields = {
  originAddress: "İstanbul",
  destinationAddress: "Ankara",
  distanceKm: "450",
  tonnage: "8",
};

describe("marketplace-service: listOpenShipmentsForBidding / submitBid", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("lists shipments left unassigned (supplierCompanyId null) and PENDING", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const openShipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
    });
    const directShipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
    });

    const open = await marketplaceService.listOpenShipmentsForBidding(supplierCtx);

    expect(open.map((s) => s.id)).toContain(openShipment.id);
    expect(open.map((s) => s.id)).not.toContain(directShipment.id);
  });

  it("rejects a CUSTOMER-role caller", async () => {
    const customerCtx = await createCustomerContext();
    companyIds.push(customerCtx.companyId);

    await expect(
      marketplaceService.listOpenShipmentsForBidding(customerCtx)
    ).rejects.toThrow(UnauthorizedError);
  });

  it("submits a bid, notifying the customer", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
    });

    const bid = await marketplaceService.submitBid(supplierCtx, shipment.id, {
      price: 12000,
      message: "İki gün içinde teslim edebiliriz",
    });

    expect(bid.price.toNumber()).toBe(12000);
    expect(bid.supplierCompanyId).toBe(supplierCtx.companyId);

    const notifications = await prisma.notification.findMany({
      where: { companyId: customerCtx.companyId, type: "BID_SUBMITTED" },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].relatedShipmentId).toBe(shipment.id);
  });

  it("resubmitting overwrites the same bid row rather than creating a duplicate", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
    });

    await marketplaceService.submitBid(supplierCtx, shipment.id, { price: 12000 });
    await marketplaceService.submitBid(supplierCtx, shipment.id, { price: 11000 });

    const bids = await prisma.shipmentBid.findMany({
      where: { shipmentId: shipment.id },
    });
    expect(bids).toHaveLength(1);
    expect(bids[0].price.toNumber()).toBe(11000);
  });

  it("rejects a bid on a shipment that already has a direct supplier", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    const otherSupplierCtx = await createSupplierContext();
    companyIds.push(
      customerCtx.companyId,
      supplierCtx.companyId,
      otherSupplierCtx.companyId
    );

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
    });

    await expect(
      marketplaceService.submitBid(otherSupplierCtx, shipment.id, { price: 12000 })
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects a non-positive price", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
    });

    await expect(
      marketplaceService.submitBid(supplierCtx, shipment.id, { price: 0 })
    ).rejects.toThrow();
  });
});

describe("marketplace-service: acceptBid", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("accepting a bid assigns the supplier, sets agreedPrice, and approves the price immediately", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
    });
    const bid = await marketplaceService.submitBid(supplierCtx, shipment.id, {
      price: 12000,
    });

    const updated = await marketplaceService.acceptBid(
      customerCtx,
      shipment.id,
      bid.id
    );

    expect(updated.supplierCompanyId).toBe(supplierCtx.companyId);
    expect(updated.agreedPrice?.toNumber()).toBe(12000);
    expect(updated.priceProposedBy).toBe("SUPPLIER");
    expect(updated.priceApprovedAt).not.toBeNull();
  });

  it("rejects the other competing bids and notifies their suppliers", async () => {
    const customerCtx = await createCustomerContext();
    const winnerCtx = await createSupplierContext();
    const loserCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, winnerCtx.companyId, loserCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
    });
    const winningBid = await marketplaceService.submitBid(winnerCtx, shipment.id, {
      price: 12000,
    });
    await marketplaceService.submitBid(loserCtx, shipment.id, { price: 13000 });

    await marketplaceService.acceptBid(customerCtx, shipment.id, winningBid.id);

    const loserBid = await prisma.shipmentBid.findFirst({
      where: { shipmentId: shipment.id, supplierCompanyId: loserCtx.companyId },
    });
    expect(loserBid?.status).toBe("REJECTED");

    const notifications = await prisma.notification.findMany({
      where: { companyId: loserCtx.companyId, type: "BID_REJECTED" },
    });
    expect(notifications).toHaveLength(1);
  });

  it("lets the winning supplier proceed straight to assignVehicleAndDriver (no redundant approval gate)", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
    });
    const bid = await marketplaceService.submitBid(supplierCtx, shipment.id, {
      price: 12000,
    });
    await marketplaceService.acceptBid(customerCtx, shipment.id, bid.id);

    const bids = await marketplaceService.listBidsForShipment(customerCtx, shipment.id);
    expect(bids.find((b) => b.id === bid.id)?.status).toBe("ACCEPTED");
  });

  it("rejects a customer who doesn't own the shipment", async () => {
    const customerCtx = await createCustomerContext();
    const otherCustomerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(
      customerCtx.companyId,
      otherCustomerCtx.companyId,
      supplierCtx.companyId
    );

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
    });
    const bid = await marketplaceService.submitBid(supplierCtx, shipment.id, {
      price: 12000,
    });

    await expect(
      marketplaceService.acceptBid(otherCustomerCtx, shipment.id, bid.id)
    ).rejects.toThrow(NotFoundError);
  });

  it("requires a fresh customer approval after assignment, even though accepting the bid already approved that price", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
    });
    const bid = await marketplaceService.submitBid(supplierCtx, shipment.id, {
      price: 12000,
    });
    const accepted = await marketplaceService.acceptBid(
      customerCtx,
      shipment.id,
      bid.id
    );
    expect(accepted.priceApprovedAt).not.toBeNull();

    const vehicle = await createTestVehicle(supplierCtx.companyId);
    const driver = await createTestDriver(supplierCtx.companyId);
    const assigned = await assignVehicleAndDriver(supplierCtx, {
      shipmentId: shipment.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      // A different price than the accepted bid — without clearing
      // priceApprovedAt on assignment, this would silently take effect as
      // "already approved" despite the customer never having agreed to it.
      agreedPrice: 13000,
    });

    expect(assigned.agreedPrice?.toNumber()).toBe(13000);
    expect(assigned.priceApprovedAt).toBeNull();
  });

  it("rejects re-accepting once the shipment is no longer open (already has a supplier)", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
    });
    const bid = await marketplaceService.submitBid(supplierCtx, shipment.id, {
      price: 12000,
    });
    await marketplaceService.acceptBid(customerCtx, shipment.id, bid.id);

    // Accepting the first bid clears supplierCompanyId to non-null, so the
    // shipment no longer matches acceptBid's "still open" lookup — it fails
    // there rather than at the (now moot) bid-status check.
    await expect(
      marketplaceService.acceptBid(customerCtx, shipment.id, bid.id)
    ).rejects.toThrow(NotFoundError);
  });
});
