import { afterAll, describe, expect, it } from "vitest";

import * as shipmentService from "@/core/shipment/shipment-service";
import * as ratingService from "@/core/rating/rating-service";
import {
  advanceShipmentStatus,
  advanceShipmentStatusAsDriver,
  assignVehicleAndDriver,
} from "@/core/shipment/shipment-status";
import { NotFoundError, UnauthorizedError, ValidationError } from "@/core/shared/errors";
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

async function setupCompletedShipment(companyIds: string[]) {
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

  return { customerCtx, supplierCtx, driverId: driver.id, shipmentId: shipment.id };
}

describe("rating-service: rateShipment", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("lets the customer rate a COMPLETED shipment, recording the supplier and driver", async () => {
    const { customerCtx, supplierCtx, driverId, shipmentId } =
      await setupCompletedShipment(companyIds);

    const rating = await ratingService.rateShipment(customerCtx, shipmentId, {
      score: 5,
      comment: "Zamanında ve sorunsuz teslimat",
    });

    expect(rating.score).toBe(5);
    expect(rating.comment).toBe("Zamanında ve sorunsuz teslimat");
    expect(rating.customerCompanyId).toBe(customerCtx.companyId);
    expect(rating.supplierCompanyId).toBe(supplierCtx.companyId);
    expect(rating.driverId).toBe(driverId);
  });

  it("rejects a second rating on the same shipment", async () => {
    const { customerCtx, shipmentId } = await setupCompletedShipment(companyIds);

    await ratingService.rateShipment(customerCtx, shipmentId, { score: 4 });

    await expect(
      ratingService.rateShipment(customerCtx, shipmentId, { score: 2 })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects rating a shipment that isn't COMPLETED yet", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
    });

    await expect(
      ratingService.rateShipment(customerCtx, shipment.id, { score: 5 })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a SUPPLIER-role caller", async () => {
    const { supplierCtx, shipmentId } = await setupCompletedShipment(companyIds);

    await expect(
      ratingService.rateShipment(supplierCtx, shipmentId, { score: 5 })
    ).rejects.toThrow(UnauthorizedError);
  });

  it("rejects a customer who doesn't own the shipment", async () => {
    const { shipmentId } = await setupCompletedShipment(companyIds);
    const otherCustomerCtx = await createCustomerContext();
    companyIds.push(otherCustomerCtx.companyId);

    await expect(
      ratingService.rateShipment(otherCustomerCtx, shipmentId, { score: 5 })
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects a score outside 1-5", async () => {
    const { customerCtx, shipmentId } = await setupCompletedShipment(companyIds);

    await expect(
      ratingService.rateShipment(customerCtx, shipmentId, { score: 6 })
    ).rejects.toThrow();
  });

  it("getRatingForShipment returns null when unrated", async () => {
    const { shipmentId } = await setupCompletedShipment(companyIds);

    const rating = await ratingService.getRatingForShipment(shipmentId);

    expect(rating).toBeNull();
  });
});
