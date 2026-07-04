import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { assignVehicleAndDriver } from "@/core/shipment/shipment-status";
import {
  reportShipmentIncident,
  resolveShipmentIncidentAsDispatcher,
  resolveShipmentIncidentAsDriver,
} from "@/core/shipment/shipment-incident";
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/core/shared/errors";
import {
  cleanupCompanies,
  createCustomerContext,
  createDriverContext,
  createSupplierContext,
  createTestCompany,
  createTestDriver,
  createTestPhotoFile,
  createTestVehicle,
} from "@/test/fixtures";
import { CompanyType, ShipmentStatus } from "@/generated/prisma/client";

const AGREED_PRICE = 15000;

describe("shipment-incident", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  /**
   * reportShipmentIncident only checks driverId ownership, not
   * shipment.status — an incident can be reported at any point once a
   * driver is assigned, so ASSIGNED (the earliest driver-owned state) is
   * enough setup, no need to walk through price approval/HEADING_TO_PICKUP.
   */
  async function setupAssignedShipment() {
    const ctx = await createSupplierContext();
    const customer = await createTestCompany(CompanyType.CUSTOMER);
    companyIds.push(ctx.companyId, customer.id);

    const vehicle = await createTestVehicle(ctx.companyId);
    const driver = await createTestDriver(ctx.companyId);
    const shipment = await prisma.shipment.create({
      data: {
        customerCompanyId: customer.id,
        supplierCompanyId: ctx.companyId,
        originAddress: "A",
        destinationAddress: "B",
        distanceKm: 100,
        tonnage: 5,
        status: ShipmentStatus.PENDING,
      },
    });
    const assigned = await assignVehicleAndDriver(ctx, {
      shipmentId: shipment.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      agreedPrice: AGREED_PRICE,
    });

    return {
      ctx,
      customer,
      driver,
      driverCtx: {
        driverId: driver.id,
        companyId: ctx.companyId,
        fullName: driver.fullName,
      },
      shipment: assigned,
    };
  }

  describe("reportShipmentIncident", () => {
    it("sets hasOpenIncident and creates a ShipmentIncident row", async () => {
      const { driverCtx, shipment } = await setupAssignedShipment();

      const incident = await reportShipmentIncident(driverCtx, {
        shipmentId: shipment.id,
        note: "Lastik patladı",
      });

      expect(incident.reportedByDriverId).toBe(driverCtx.driverId);
      expect(incident.note).toBe("Lastik patladı");
      expect(incident.resolvedAt).toBeNull();

      const updated = await prisma.shipment.findUniqueOrThrow({
        where: { id: shipment.id },
      });
      expect(updated.hasOpenIncident).toBe(true);
      // Reporting an incident never touches the shipment's own status.
      expect(updated.status).toBe(shipment.status);
    });

    it("saves and links an attached photo", async () => {
      const { driverCtx, shipment } = await setupAssignedShipment();

      const incident = await reportShipmentIncident(driverCtx, {
        shipmentId: shipment.id,
        photo: createTestPhotoFile(),
      });

      expect(incident.photoUrl).toMatch(new RegExp(`^${shipment.id}/`));
    });

    it("rejects a driver acting on a shipment that isn't theirs", async () => {
      const { shipment } = await setupAssignedShipment();
      const otherCompany = await createTestCompany(CompanyType.SUPPLIER);
      companyIds.push(otherCompany.id);
      const otherDriverCtx = await createDriverContext(otherCompany.id);

      await expect(
        reportShipmentIncident(otherDriverCtx, { shipmentId: shipment.id })
      ).rejects.toThrow(NotFoundError);
    });

    it("rejects reporting a second incident while one is already open", async () => {
      const { driverCtx, shipment } = await setupAssignedShipment();
      await reportShipmentIncident(driverCtx, { shipmentId: shipment.id });

      await expect(
        reportShipmentIncident(driverCtx, { shipmentId: shipment.id })
      ).rejects.toThrow(ValidationError);
    });

    it("notifies both the customer and supplier company", async () => {
      const { ctx, customer, driverCtx, shipment } =
        await setupAssignedShipment();

      await reportShipmentIncident(driverCtx, { shipmentId: shipment.id });

      const customerNotifications = await prisma.notification.findMany({
        where: { companyId: customer.id, type: "INCIDENT_REPORTED" },
      });
      const supplierNotifications = await prisma.notification.findMany({
        where: { companyId: ctx.companyId, type: "INCIDENT_REPORTED" },
      });
      expect(customerNotifications).toHaveLength(1);
      expect(supplierNotifications).toHaveLength(1);
    });
  });

  describe("resolving an incident", () => {
    it("the driver can resolve their own reported incident", async () => {
      const { driverCtx, shipment } = await setupAssignedShipment();
      await reportShipmentIncident(driverCtx, { shipmentId: shipment.id });

      const resolved = await resolveShipmentIncidentAsDriver(driverCtx, {
        shipmentId: shipment.id,
        resolutionNote: "Lastik değiştirildi",
      });

      expect(resolved.resolvedByDriverId).toBe(driverCtx.driverId);
      expect(resolved.resolvedByUserId).toBeNull();
      expect(resolved.resolutionNote).toBe("Lastik değiştirildi");
      expect(resolved.resolvedAt).not.toBeNull();

      const updated = await prisma.shipment.findUniqueOrThrow({
        where: { id: shipment.id },
      });
      expect(updated.hasOpenIncident).toBe(false);
    });

    it("the dispatcher (SUPPLIER) can resolve on the driver's behalf", async () => {
      const { ctx, driverCtx, shipment } = await setupAssignedShipment();
      await reportShipmentIncident(driverCtx, { shipmentId: shipment.id });

      const resolved = await resolveShipmentIncidentAsDispatcher(ctx, {
        shipmentId: shipment.id,
      });

      expect(resolved.resolvedByUserId).toBe(ctx.userId);
      expect(resolved.resolvedByDriverId).toBeNull();
    });

    it("rejects a CUSTOMER company trying to resolve", async () => {
      const { driverCtx, shipment } = await setupAssignedShipment();
      await reportShipmentIncident(driverCtx, { shipmentId: shipment.id });
      const customerCtx = await createCustomerContext();
      companyIds.push(customerCtx.companyId);

      await expect(
        resolveShipmentIncidentAsDispatcher(customerCtx, {
          shipmentId: shipment.id,
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it("rejects a different supplier company resolving a shipment that isn't theirs", async () => {
      const { driverCtx, shipment } = await setupAssignedShipment();
      await reportShipmentIncident(driverCtx, { shipmentId: shipment.id });
      const otherSupplierCtx = await createSupplierContext();
      companyIds.push(otherSupplierCtx.companyId);

      await expect(
        resolveShipmentIncidentAsDispatcher(otherSupplierCtx, {
          shipmentId: shipment.id,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("rejects resolving when there is no open incident", async () => {
      const { driverCtx, shipment } = await setupAssignedShipment();

      await expect(
        resolveShipmentIncidentAsDriver(driverCtx, {
          shipmentId: shipment.id,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("notifies both sides on resolution", async () => {
      const { ctx, customer, driverCtx, shipment } =
        await setupAssignedShipment();
      await reportShipmentIncident(driverCtx, { shipmentId: shipment.id });

      await resolveShipmentIncidentAsDriver(driverCtx, {
        shipmentId: shipment.id,
      });

      const customerNotifications = await prisma.notification.findMany({
        where: { companyId: customer.id, type: "INCIDENT_RESOLVED" },
      });
      const supplierNotifications = await prisma.notification.findMany({
        where: { companyId: ctx.companyId, type: "INCIDENT_RESOLVED" },
      });
      expect(customerNotifications).toHaveLength(1);
      expect(supplierNotifications).toHaveLength(1);
    });
  });
});
