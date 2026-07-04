import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import * as gateEventService from "@/core/gate-guard/gate-event-service";
import { assignVehicleAndDriver } from "@/core/shipment/shipment-status";
import { InvalidTransitionError, NotFoundError } from "@/core/shared/errors";
import {
  cleanupCompanies,
  createCustomerContext,
  createGateGuardContext,
  createSupplierContext,
  createTestDriver,
  createTestVehicle,
} from "@/test/fixtures";
import { GateEventType } from "@/generated/prisma/client";

describe("gate-event-service", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  async function setupAssignedShipmentWithGateGuard() {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const vehicle = await createTestVehicle(supplierCtx.companyId);
    const driver = await createTestDriver(supplierCtx.companyId);
    const shipment = await prisma.shipment.create({
      data: {
        customerCompanyId: customerCtx.companyId,
        supplierCompanyId: supplierCtx.companyId,
        originAddress: "A",
        destinationAddress: "B",
        distanceKm: 100,
        tonnage: 5,
        status: "PENDING",
      },
    });
    await assignVehicleAndDriver(supplierCtx, {
      shipmentId: shipment.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      agreedPrice: 15000,
    });
    const gateGuardCtx = await createGateGuardContext(customerCtx.companyId);

    return { customerCtx, supplierCtx, gateGuardCtx, shipmentId: shipment.id };
  }

  it("lists only the gate guard's own company's active (vehicle-assigned) shipments", async () => {
    const { gateGuardCtx, shipmentId } =
      await setupAssignedShipmentWithGateGuard();
    const otherCustomerCtx = await createCustomerContext();
    companyIds.push(otherCustomerCtx.companyId);

    const shipments =
      await gateEventService.listActiveShipmentsForGateGuard(gateGuardCtx);

    expect(shipments.map((s) => s.id)).toEqual([shipmentId]);
  });

  it("logs an entry then an exit, in order", async () => {
    const { gateGuardCtx, shipmentId } =
      await setupAssignedShipmentWithGateGuard();

    await gateEventService.logGateEvent(
      gateGuardCtx,
      shipmentId,
      GateEventType.VEHICLE_ENTERED
    );
    const afterEntry = await gateEventService.listActiveShipmentsForGateGuard(
      gateGuardCtx
    );
    expect(afterEntry[0].gateEvents[0].eventType).toBe("VEHICLE_ENTERED");

    await gateEventService.logGateEvent(
      gateGuardCtx,
      shipmentId,
      GateEventType.VEHICLE_EXITED
    );
    const afterExit = await gateEventService.listActiveShipmentsForGateGuard(
      gateGuardCtx
    );
    expect(afterExit[0].gateEvents[0].eventType).toBe("VEHICLE_EXITED");
  });

  it("makes exit terminal — no further entry or exit can be logged afterward", async () => {
    const { gateGuardCtx, shipmentId } =
      await setupAssignedShipmentWithGateGuard();
    await gateEventService.logGateEvent(
      gateGuardCtx,
      shipmentId,
      GateEventType.VEHICLE_ENTERED
    );
    await gateEventService.logGateEvent(
      gateGuardCtx,
      shipmentId,
      GateEventType.VEHICLE_EXITED
    );

    await expect(
      gateEventService.logGateEvent(
        gateGuardCtx,
        shipmentId,
        GateEventType.VEHICLE_ENTERED
      )
    ).rejects.toThrow(InvalidTransitionError);
    await expect(
      gateEventService.logGateEvent(
        gateGuardCtx,
        shipmentId,
        GateEventType.VEHICLE_EXITED
      )
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects logging an entry when the vehicle is already inside", async () => {
    const { gateGuardCtx, shipmentId } =
      await setupAssignedShipmentWithGateGuard();
    await gateEventService.logGateEvent(
      gateGuardCtx,
      shipmentId,
      GateEventType.VEHICLE_ENTERED
    );

    await expect(
      gateEventService.logGateEvent(
        gateGuardCtx,
        shipmentId,
        GateEventType.VEHICLE_ENTERED
      )
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects logging an exit before any entry", async () => {
    const { gateGuardCtx, shipmentId } =
      await setupAssignedShipmentWithGateGuard();

    await expect(
      gateEventService.logGateEvent(
        gateGuardCtx,
        shipmentId,
        GateEventType.VEHICLE_EXITED
      )
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects a gate guard acting on another company's shipment", async () => {
    const { shipmentId } = await setupAssignedShipmentWithGateGuard();
    const otherCustomerCtx = await createCustomerContext();
    companyIds.push(otherCustomerCtx.companyId);
    const otherGateGuardCtx = await createGateGuardContext(
      otherCustomerCtx.companyId
    );

    await expect(
      gateEventService.logGateEvent(
        otherGateGuardCtx,
        shipmentId,
        GateEventType.VEHICLE_ENTERED
      )
    ).rejects.toThrow(NotFoundError);
  });

  it("notifies the gate guard's own company", async () => {
    const { customerCtx, gateGuardCtx, shipmentId } =
      await setupAssignedShipmentWithGateGuard();

    await gateEventService.logGateEvent(
      gateGuardCtx,
      shipmentId,
      GateEventType.VEHICLE_ENTERED
    );

    const notifications = await prisma.notification.findMany({
      where: { companyId: customerCtx.companyId, type: "VEHICLE_ENTERED_GATE" },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].relatedShipmentId).toBe(shipmentId);
  });
});
