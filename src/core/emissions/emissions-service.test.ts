import { afterAll, describe, expect, it } from "vitest";

import * as shipmentService from "@/core/shipment/shipment-service";
import { getCompanyEmissionsSummary } from "@/core/emissions/emissions-service";
import { calculateShipmentEmissionsKg } from "@/lib/emissions";
import {
  advanceShipmentStatus,
  advanceShipmentStatusAsDriver,
  assignVehicleAndDriver,
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
import { VehicleType } from "@/generated/prisma/client";

const baseFields = {
  originAddress: "İstanbul",
  destinationAddress: "Ankara",
  distanceKm: "500",
  tonnage: "8",
};

describe("emissions-service: getCompanyEmissionsSummary", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("returns zero total and an empty monthly breakdown with no completed shipments", async () => {
    const supplierCtx = await createSupplierContext();
    companyIds.push(supplierCtx.companyId);

    const summary = await getCompanyEmissionsSummary(supplierCtx);

    expect(summary.totalKg).toBe(0);
    expect(summary.byMonth).toHaveLength(0);
  });

  it("computes the total from a completed shipment's distance/tonnage/vehicle type, visible symmetrically to both sides", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const vehicle = await createTestVehicle(supplierCtx.companyId, {
      vehicleType: VehicleType.TIR,
    });
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

    const expectedKg = calculateShipmentEmissionsKg(500, 8, VehicleType.TIR);

    const [supplierSummary, customerSummary] = await Promise.all([
      getCompanyEmissionsSummary(supplierCtx),
      getCompanyEmissionsSummary(customerCtx),
    ]);

    for (const summary of [supplierSummary, customerSummary]) {
      expect(summary.totalKg).toBeCloseTo(expectedKg, 5);
      expect(summary.byMonth).toHaveLength(1);
      expect(summary.byMonth[0].kg).toBeCloseTo(expectedKg, 5);
    }
  });
});
