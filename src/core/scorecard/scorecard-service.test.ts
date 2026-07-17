import { afterAll, describe, expect, it } from "vitest";

import * as shipmentService from "@/core/shipment/shipment-service";
import * as ratingService from "@/core/rating/rating-service";
import * as scorecardService from "@/core/scorecard/scorecard-service";
import {
  advanceShipmentStatus,
  advanceShipmentStatusAsDriver,
  assignVehicleAndDriver,
  cancelShipment,
} from "@/core/shipment/shipment-status";
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

async function createCompletedShipment(
  customerCtx: Awaited<ReturnType<typeof createCustomerContext>>,
  supplierCtx: Awaited<ReturnType<typeof createSupplierContext>>,
  options: { eta?: Date } = {}
) {
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
  if (options.eta) {
    await shipmentService.setPickupEta(supplierCtx, shipment.id, {
      estimatedPickupArrivalAt: options.eta,
    });
  }
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

  return shipment;
}

describe("scorecard-service: getSupplierScorecard", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("returns nulls/zeros for a supplier with no history", async () => {
    const supplierCtx = await createSupplierContext();
    companyIds.push(supplierCtx.companyId);

    const scorecard = await scorecardService.getSupplierScorecard(
      supplierCtx.companyId
    );

    expect(scorecard.averageRating).toBeNull();
    expect(scorecard.ratingCount).toBe(0);
    expect(scorecard.onTimePickupRate).toBeNull();
    expect(scorecard.cancellationRate).toBeNull();
    expect(scorecard.completedShipmentCount).toBe(0);
  });

  it("averages ratings across completed shipments", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const shipmentA = await createCompletedShipment(customerCtx, supplierCtx);
    const shipmentB = await createCompletedShipment(customerCtx, supplierCtx);
    await ratingService.rateShipment(customerCtx, shipmentA.id, { score: 4 });
    await ratingService.rateShipment(customerCtx, shipmentB.id, { score: 2 });

    const scorecard = await scorecardService.getSupplierScorecard(
      supplierCtx.companyId
    );

    expect(scorecard.averageRating).toBe(3);
    expect(scorecard.ratingCount).toBe(2);
    expect(scorecard.completedShipmentCount).toBe(2);
  });

  it("computes on-time pickup rate only from shipments with an ETA that reached LOADING", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    // On time: ETA far in the future relative to when LOADING is recorded.
    await createCompletedShipment(customerCtx, supplierCtx, {
      eta: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    // Late: ETA far in the past relative to when LOADING is recorded (now).
    await createCompletedShipment(customerCtx, supplierCtx, {
      eta: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    // No ETA set at all — must not count toward eligible.
    await createCompletedShipment(customerCtx, supplierCtx);

    const scorecard = await scorecardService.getSupplierScorecard(
      supplierCtx.companyId
    );

    expect(scorecard.onTimePickupRate).toBe(0.5);
  });

  it("computes cancellation rate across all shipments regardless of status", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    await createCompletedShipment(customerCtx, supplierCtx);
    const toCancel = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
    });
    await cancelShipment(supplierCtx, toCancel.id);

    const scorecard = await scorecardService.getSupplierScorecard(
      supplierCtx.companyId
    );

    expect(scorecard.cancellationRate).toBe(0.5);
    expect(scorecard.completedShipmentCount).toBe(1);
  });
});
