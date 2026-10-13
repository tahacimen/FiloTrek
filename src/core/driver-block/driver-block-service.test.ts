import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  addDriverBlock,
  listDriverBlocks,
  removeDriverBlock,
} from "@/core/driver-block/driver-block-service";
import { assignVehicleAndDriver } from "@/core/shipment/shipment-status";
import { ValidationError } from "@/core/shared/errors";
import {
  cleanupCompanies,
  createCustomerContext,
  createSupplierContext,
  createTestDriver,
  createTestVehicle,
} from "@/test/fixtures";
import { ShipmentStatus } from "@/generated/prisma/client";

describe("driver-block-service", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("adds, lists and removes blocks (customer-only)", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);

    const block = await addDriverBlock(ctx, {
      fullName: "Kötü Şoför",
      tcNumber: "12345678901",
      licenseNumber: "34dr9999",
      reason: "Hasar verdi",
    });
    expect(block.licenseNumber).toBe("34DR9999"); // uppercased
    expect(block.tcNumber).toBe("12345678901");

    const list = await listDriverBlocks(ctx);
    expect(list.map((b) => b.id)).toContain(block.id);

    await removeDriverBlock(ctx, block.id);
    expect((await listDriverBlocks(ctx)).map((b) => b.id)).not.toContain(
      block.id
    );
  });

  it("requires at least a TC or a license number", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);
    await expect(
      addDriverBlock(ctx, {
        fullName: "Boş",
        tcNumber: "",
        licenseNumber: "",
        reason: "",
      })
    ).rejects.toThrow();
  });

  it("rejects a supplier adding a block", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    await expect(
      addDriverBlock(ctx, { tcNumber: "12345678901", licenseNumber: "" })
    ).rejects.toThrow();
  });

  it("prevents assigning a driver the shipment's customer has blocked", async () => {
    const supplier = await createSupplierContext();
    const customer = await createCustomerContext();
    companyIds.push(supplier.companyId, customer.companyId);

    const vehicle = await createTestVehicle(supplier.companyId);
    const driver = await createTestDriver(supplier.companyId);

    // Customer blocks this exact driver by license number.
    await addDriverBlock(customer, { licenseNumber: driver.licenseNumber });

    const shipment = await prisma.shipment.create({
      data: {
        customerCompanyId: customer.companyId,
        supplierCompanyId: supplier.companyId,
        originAddress: "A",
        destinationAddress: "B",
        distanceKm: 100,
        tonnage: 5,
        status: ShipmentStatus.PENDING,
      },
    });

    await expect(
      assignVehicleAndDriver(supplier, {
        shipmentId: shipment.id,
        vehicleId: vehicle.id,
        driverId: driver.id,
        agreedPrice: 10000,
      })
    ).rejects.toThrow(ValidationError);

    // The shipment stays unassigned (transaction rolled back).
    const after = await prisma.shipment.findUniqueOrThrow({
      where: { id: shipment.id },
    });
    expect(after.status).toBe(ShipmentStatus.PENDING);
    expect(after.driverId).toBeNull();
  });

  it("allows assigning a driver who is not blocked", async () => {
    const supplier = await createSupplierContext();
    const customer = await createCustomerContext();
    companyIds.push(supplier.companyId, customer.companyId);

    const vehicle = await createTestVehicle(supplier.companyId);
    const driver = await createTestDriver(supplier.companyId);
    await addDriverBlock(customer, { licenseNumber: "SOMEONE-ELSE" });

    const shipment = await prisma.shipment.create({
      data: {
        customerCompanyId: customer.companyId,
        supplierCompanyId: supplier.companyId,
        originAddress: "A",
        destinationAddress: "B",
        distanceKm: 100,
        tonnage: 5,
        status: ShipmentStatus.PENDING,
      },
    });

    const assigned = await assignVehicleAndDriver(supplier, {
      shipmentId: shipment.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      agreedPrice: 10000,
    });
    expect(assigned.status).toBe(ShipmentStatus.ASSIGNED);
    expect(assigned.driverId).toBe(driver.id);
  });
});
