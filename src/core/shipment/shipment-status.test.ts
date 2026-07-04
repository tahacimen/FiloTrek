import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  advanceShipmentStatus,
  advanceShipmentStatusAsDriver,
  assignVehicleAndDriver,
  cancelShipment,
} from "@/core/shipment/shipment-status";
import { setVehicleMaintenance } from "@/core/vehicle/vehicle-status";
import {
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from "@/core/shared/errors";
import {
  cleanupCompanies,
  createDriverContext,
  createSupplierContext,
  createTestCompany,
  createTestDriver,
  createTestPhotoFile,
  createTestVehicle,
} from "@/test/fixtures";
import {
  CompanyType,
  type NotificationType,
  ShipmentStatus,
} from "@/generated/prisma/client";

const AGREED_PRICE = 15000;

/** Test-only scaffolding: approvePrice's own behavior is covered in shipment-service.test.ts. */
function approvePriceDirectly(shipmentId: string) {
  return prisma.shipment.update({
    where: { id: shipmentId },
    data: { priceApprovedAt: new Date() },
  });
}

describe("shipment status state machine", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  async function setupPendingShipment() {
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
    return { ctx, vehicle, driver, shipment };
  }

  it("assigns a vehicle and driver, flipping both to busy statuses", async () => {
    const { ctx, vehicle, driver, shipment } = await setupPendingShipment();

    const assigned = await assignVehicleAndDriver(ctx, {
      shipmentId: shipment.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      agreedPrice: AGREED_PRICE,
    });

    expect(assigned.status).toBe(ShipmentStatus.ASSIGNED);
    expect(assigned.agreedPrice?.toNumber()).toBe(AGREED_PRICE);
    const updatedVehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { id: vehicle.id },
    });
    const updatedDriver = await prisma.driver.findUniqueOrThrow({
      where: { id: driver.id },
    });
    expect(updatedVehicle.status).toBe("ASSIGNED");
    expect(updatedDriver.status).toBe("ON_TRIP");
  });

  it("rejects assignment with a non-positive price", async () => {
    const { ctx, vehicle, driver, shipment } = await setupPendingShipment();

    await expect(
      assignVehicleAndDriver(ctx, {
        shipmentId: shipment.id,
        vehicleId: vehicle.id,
        driverId: driver.id,
        agreedPrice: 0,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects assignment when the vehicle is not available", async () => {
    const { ctx, driver, shipment } = await setupPendingShipment();
    const busyVehicle = await createTestVehicle(ctx.companyId, {
      status: "MAINTENANCE",
    });

    await expect(
      assignVehicleAndDriver(ctx, {
        shipmentId: shipment.id,
        vehicleId: busyVehicle.id,
        driverId: driver.id,
        agreedPrice: AGREED_PRICE,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects skipping a status (PENDING straight to COMPLETED)", async () => {
    const { ctx, shipment } = await setupPendingShipment();

    await expect(
      advanceShipmentStatus(ctx, {
        shipmentId: shipment.id,
        targetStatus: ShipmentStatus.COMPLETED,
      })
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects PENDING -> ASSIGNED via the generic advance action (must go through assignVehicleAndDriver)", async () => {
    const { ctx, vehicle, driver, shipment } = await setupPendingShipment();

    await expect(
      advanceShipmentStatus(ctx, {
        shipmentId: shipment.id,
        targetStatus: ShipmentStatus.ASSIGNED,
      })
    ).rejects.toThrow(InvalidTransitionError);

    // Confirm it's still untouched and assignable the correct way afterwards
    // — the guard rejects cleanly rather than leaving a half-applied state.
    const untouched = await prisma.shipment.findUniqueOrThrow({
      where: { id: shipment.id },
    });
    expect(untouched.status).toBe(ShipmentStatus.PENDING);
    expect(untouched.vehicleId).toBeNull();

    const assigned = await assignVehicleAndDriver(ctx, {
      shipmentId: shipment.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      agreedPrice: AGREED_PRICE,
    });
    expect(assigned.status).toBe(ShipmentStatus.ASSIGNED);
    expect(assigned.vehicleId).toBe(vehicle.id);
  });

  it("rejects skipping HEADING_TO_PICKUP (ASSIGNED straight to LOADING)", async () => {
    const { ctx, vehicle, driver, shipment } = await setupPendingShipment();
    await assignVehicleAndDriver(ctx, {
      shipmentId: shipment.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      agreedPrice: AGREED_PRICE,
    });

    await expect(
      advanceShipmentStatus(ctx, {
        shipmentId: shipment.id,
        targetStatus: ShipmentStatus.LOADING,
      })
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects advancing to HEADING_TO_PICKUP when the customer hasn't approved the price", async () => {
    const { ctx, vehicle, driver, shipment } = await setupPendingShipment();
    await assignVehicleAndDriver(ctx, {
      shipmentId: shipment.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      agreedPrice: AGREED_PRICE,
    });

    await expect(
      advanceShipmentStatus(ctx, {
        shipmentId: shipment.id,
        targetStatus: ShipmentStatus.HEADING_TO_PICKUP,
      })
    ).rejects.toThrow(ValidationError);

    const untouched = await prisma.shipment.findUniqueOrThrow({
      where: { id: shipment.id },
    });
    expect(untouched.status).toBe(ShipmentStatus.ASSIGNED);
  });

  it("advancing to HEADING_TO_PICKUP notifies the customer", async () => {
    const { ctx, vehicle, driver, shipment } = await setupPendingShipment();
    await assignVehicleAndDriver(ctx, {
      shipmentId: shipment.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      agreedPrice: AGREED_PRICE,
    });
    await approvePriceDirectly(shipment.id);

    const advanced = await advanceShipmentStatus(ctx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.HEADING_TO_PICKUP,
    });
    expect(advanced.status).toBe(ShipmentStatus.HEADING_TO_PICKUP);

    const updatedVehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { id: vehicle.id },
    });
    expect(updatedVehicle.status).toBe("HEADING_TO_PICKUP");

    const notifications = await prisma.notification.findMany({
      where: { companyId: shipment.customerCompanyId },
    });
    expect(notifications.map((n) => n.type).sort()).toEqual(
      ["PRICE_PROPOSED", "VEHICLE_DEPARTED"].sort()
    );
  });

  it("auto-releases vehicle and driver back to AVAILABLE on completion, with a full audit trail", async () => {
    const { ctx, vehicle, driver, shipment } = await setupPendingShipment();

    await assignVehicleAndDriver(ctx, {
      shipmentId: shipment.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      agreedPrice: AGREED_PRICE,
    });
    await approvePriceDirectly(shipment.id);
    await advanceShipmentStatus(ctx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.HEADING_TO_PICKUP,
    });
    await advanceShipmentStatus(ctx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.LOADING,
    });
    await advanceShipmentStatus(ctx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.AT_PICKUP_GATE,
    });
    await advanceShipmentStatus(ctx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.EN_ROUTE,
    });
    await advanceShipmentStatus(ctx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.AT_DELIVERY_POINT,
    });
    const completed = await advanceShipmentStatus(ctx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.COMPLETED,
    });

    expect(completed.status).toBe(ShipmentStatus.COMPLETED);
    expect(completed.completedAt).not.toBeNull();

    const finalVehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { id: vehicle.id },
    });
    const finalDriver = await prisma.driver.findUniqueOrThrow({
      where: { id: driver.id },
    });
    expect(finalVehicle.status).toBe("AVAILABLE");
    expect(finalDriver.status).toBe("AVAILABLE");

    const history = await prisma.statusHistory.findMany({
      where: { entityType: "SHIPMENT", entityId: shipment.id },
      orderBy: { createdAt: "asc" },
    });
    expect(history.map((h) => h.toStatus)).toEqual([
      "ASSIGNED",
      "HEADING_TO_PICKUP",
      "LOADING",
      "AT_PICKUP_GATE",
      "EN_ROUTE",
      "AT_DELIVERY_POINT",
      "COMPLETED",
    ]);
  });

  it("cancels a shipment and releases its vehicle/driver", async () => {
    const { ctx, vehicle, driver, shipment } = await setupPendingShipment();
    await assignVehicleAndDriver(ctx, {
      shipmentId: shipment.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      agreedPrice: AGREED_PRICE,
    });

    const cancelled = await cancelShipment(ctx, shipment.id);
    expect(cancelled.status).toBe(ShipmentStatus.CANCELLED);
    expect(cancelled.cancelledAt).not.toBeNull();

    const finalVehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { id: vehicle.id },
    });
    expect(finalVehicle.status).toBe("AVAILABLE");
  });

  it("refuses to put a vehicle on an active shipment into maintenance", async () => {
    const { ctx, vehicle, driver, shipment } = await setupPendingShipment();
    await assignVehicleAndDriver(ctx, {
      shipmentId: shipment.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      agreedPrice: AGREED_PRICE,
    });

    await expect(setVehicleMaintenance(ctx, vehicle.id, true)).rejects.toThrow(
      ValidationError
    );
  });

  it("allows maintenance for an available vehicle and back out again", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const vehicle = await createTestVehicle(ctx.companyId);

    const inMaintenance = await setVehicleMaintenance(ctx, vehicle.id, true);
    expect(inMaintenance.status).toBe("MAINTENANCE");

    const backToAvailable = await setVehicleMaintenance(ctx, vehicle.id, false);
    expect(backToAvailable.status).toBe("AVAILABLE");
  });
});

describe("advanceShipmentStatusAsDriver", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  async function setupHeadingToPickupShipment() {
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
    await assignVehicleAndDriver(ctx, {
      shipmentId: shipment.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      agreedPrice: AGREED_PRICE,
    });
    await approvePriceDirectly(shipment.id);
    const heading = await advanceShipmentStatus(ctx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.HEADING_TO_PICKUP,
    });

    return {
      ctx,
      customer,
      vehicle,
      driver,
      driverCtx: {
        driverId: driver.id,
        companyId: ctx.companyId,
        fullName: driver.fullName,
      },
      shipment: heading,
    };
  }

  it("rejects a driver acting on a shipment that isn't assigned to them", async () => {
    const { shipment } = await setupHeadingToPickupShipment();
    const otherCompany = await createTestCompany(CompanyType.SUPPLIER);
    companyIds.push(otherCompany.id);
    const otherDriverCtx = await createDriverContext(otherCompany.id);

    await expect(
      advanceShipmentStatusAsDriver(otherDriverCtx, {
        shipmentId: shipment.id,
        targetStatus: ShipmentStatus.LOADING,
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects target statuses outside the driver's allowlist", async () => {
    const { driverCtx, shipment } = await setupHeadingToPickupShipment();

    await expect(
      advanceShipmentStatusAsDriver(driverCtx, {
        shipmentId: shipment.id,
        targetStatus: ShipmentStatus.CANCELLED,
      })
    ).rejects.toThrow(InvalidTransitionError);
    await expect(
      advanceShipmentStatusAsDriver(driverCtx, {
        shipmentId: shipment.id,
        targetStatus: ShipmentStatus.HEADING_TO_PICKUP,
      })
    ).rejects.toThrow(InvalidTransitionError);
    await expect(
      advanceShipmentStatusAsDriver(driverCtx, {
        shipmentId: shipment.id,
        targetStatus: ShipmentStatus.ASSIGNED,
      })
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects AT_PICKUP_GATE -> EN_ROUTE with no photo attached", async () => {
    const { driverCtx, shipment } = await setupHeadingToPickupShipment();
    await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.LOADING,
    });
    await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.AT_PICKUP_GATE,
    });

    await expect(
      advanceShipmentStatusAsDriver(driverCtx, {
        shipmentId: shipment.id,
        targetStatus: ShipmentStatus.EN_ROUTE,
      })
    ).rejects.toThrow(ValidationError);

    // Rejected before the transaction — status must still be untouched.
    const untouched = await prisma.shipment.findUniqueOrThrow({
      where: { id: shipment.id },
    });
    expect(untouched.status).toBe(ShipmentStatus.AT_PICKUP_GATE);
  });

  it("rejects AT_PICKUP_GATE -> EN_ROUTE with an empty (size 0) photo, matching a file input left empty", async () => {
    const { driverCtx, shipment } = await setupHeadingToPickupShipment();
    await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.LOADING,
    });
    await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.AT_PICKUP_GATE,
    });
    const emptyPhoto = new File([], "empty.jpg", { type: "image/jpeg" });

    await expect(
      advanceShipmentStatusAsDriver(driverCtx, {
        shipmentId: shipment.id,
        targetStatus: ShipmentStatus.EN_ROUTE,
        photo: emptyPhoto,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("accepts AT_PICKUP_GATE -> EN_ROUTE with a real photo, recording it on the SHIPMENT history row", async () => {
    const { driverCtx, shipment } = await setupHeadingToPickupShipment();
    await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.LOADING,
    });
    await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.AT_PICKUP_GATE,
    });

    const advanced = await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.EN_ROUTE,
      photo: createTestPhotoFile(),
    });
    expect(advanced.status).toBe(ShipmentStatus.EN_ROUTE);

    const history = await prisma.statusHistory.findFirst({
      where: {
        entityType: "SHIPMENT",
        entityId: shipment.id,
        toStatus: "EN_ROUTE",
      },
    });
    expect(history?.photoUrl).toMatch(new RegExp(`^${shipment.id}/`));

    // Never applied to the Vehicle entity's own history row for the same transition.
    const vehicleHistory = await prisma.statusHistory.findFirst({
      where: { entityType: "VEHICLE", entityId: shipment.vehicleId! },
      orderBy: { createdAt: "desc" },
    });
    expect(vehicleHistory?.photoUrl).toBeNull();
  });

  it("lets the assigned driver advance through to completion, notifying both sides and recording the driver (not a user) in the audit trail", async () => {
    const { ctx, customer, vehicle, driver, driverCtx, shipment } =
      await setupHeadingToPickupShipment();

    await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.LOADING,
      note: "Kapıda 10 dk bekledim",
    });
    await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.AT_PICKUP_GATE,
    });
    await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.EN_ROUTE,
      photo: createTestPhotoFile(),
    });
    await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.AT_DELIVERY_POINT,
    });
    const completed = await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId: shipment.id,
      targetStatus: ShipmentStatus.COMPLETED,
    });

    expect(completed.status).toBe(ShipmentStatus.COMPLETED);

    const finalVehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { id: vehicle.id },
    });
    const finalDriver = await prisma.driver.findUniqueOrThrow({
      where: { id: driver.id },
    });
    expect(finalVehicle.status).toBe("AVAILABLE");
    expect(finalDriver.status).toBe("AVAILABLE");

    const history = await prisma.statusHistory.findMany({
      where: {
        entityType: "SHIPMENT",
        entityId: shipment.id,
        source: "DRIVER",
      },
      orderBy: { createdAt: "asc" },
    });
    expect(history.map((h) => h.toStatus)).toEqual([
      "LOADING",
      "AT_PICKUP_GATE",
      "EN_ROUTE",
      "AT_DELIVERY_POINT",
      "COMPLETED",
    ]);
    expect(history.every((h) => h.changedByDriverId === driver.id)).toBe(true);
    expect(history.every((h) => h.changedByUserId === null)).toBe(true);
    expect(history[0].sourceReference).toBe("Kapıda 10 dk bekledim");

    const driverNotificationTypes: NotificationType[] = [
      "DRIVER_ARRIVED_PICKUP",
      "DRIVER_AT_PICKUP_GATE",
      "DRIVER_DEPARTED_PICKUP",
      "DRIVER_ARRIVED_DELIVERY",
      "DRIVER_COMPLETED_DELIVERY",
    ];
    const customerNotifications = await prisma.notification.findMany({
      where: { companyId: customer.id, type: { in: driverNotificationTypes } },
    });
    const supplierNotifications = await prisma.notification.findMany({
      where: {
        companyId: ctx.companyId,
        type: { in: driverNotificationTypes },
      },
    });
    expect(customerNotifications).toHaveLength(5);
    expect(supplierNotifications).toHaveLength(5);
  });
});
