import { afterAll, describe, expect, it } from "vitest";

import * as shipmentService from "@/core/shipment/shipment-service";
import { getOperationalKpis } from "@/core/dashboard/dashboard-service";
import {
  advanceShipmentStatus,
  advanceShipmentStatusAsDriver,
  assignVehicleAndDriver,
} from "@/core/shipment/shipment-status";
import { reportShipmentIncident } from "@/core/shipment/shipment-incident";
import {
  cleanupCompanies,
  createCustomerContext,
  createSupplierContext,
  createTestDriver,
  createTestVehicle,
} from "@/test/fixtures";
import type { DriverContext } from "@/core/shared/driver-context";

const baseFields = {
  originAddress: "İstanbul",
  destinationAddress: "Ankara",
  distanceKm: "500",
  tonnage: "8",
};

describe("dashboard-service: getOperationalKpis", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("returns nulls for a company with no shipment history yet", async () => {
    const supplierCtx = await createSupplierContext();
    companyIds.push(supplierCtx.companyId);

    const kpis = await getOperationalKpis(supplierCtx);

    expect(kpis.onTimePickupRate).toBeNull();
    expect(kpis.averagePricePerKm).toBeNull();
    expect(kpis.incidentRate).toBeNull();
    expect(kpis.shipmentVolumeTrend).toHaveLength(14);
    expect(kpis.shipmentVolumeTrend.every((row) => row.count === 0)).toBe(true);
  });

  it("computes price/km, on-time rate, and incident rate symmetrically for both sides of the same shipment", async () => {
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
      agreedPrice: 5000, // 5000 / 500km = 10 per km
    });
    await shipmentService.approvePrice(customerCtx, shipment.id);
    await advanceShipmentStatus(supplierCtx, {
      shipmentId: shipment.id,
      targetStatus: "HEADING_TO_PICKUP" as const,
    });
    // ETA far in the future — LOADING (recorded "now") arrives well before it.
    await shipmentService.setPickupEta(supplierCtx, shipment.id, {
      estimatedPickupArrivalAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: "LOADING",
    });
    await reportShipmentIncident(driverCtx, {
      shipmentId: shipment.id,
      note: "Lastik patladı",
    });

    const [supplierKpis, customerKpis] = await Promise.all([
      getOperationalKpis(supplierCtx),
      getOperationalKpis(customerCtx),
    ]);

    for (const kpis of [supplierKpis, customerKpis]) {
      expect(kpis.averagePricePerKm).toBe(10);
      expect(kpis.onTimePickupRate).toBe(1);
      expect(kpis.incidentRate).toBe(1);
    }
  });

  it("does not count a shipment with an ETA that never reached LOADING as eligible", async () => {
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
      agreedPrice: 5000,
    });
    await shipmentService.setPickupEta(supplierCtx, shipment.id, {
      estimatedPickupArrivalAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    // Still ASSIGNED — never advanced to HEADING_TO_PICKUP/LOADING.

    const kpis = await getOperationalKpis(supplierCtx);

    expect(kpis.onTimePickupRate).toBeNull();
  });
});
