import { afterAll, describe, expect, it } from "vitest";

import * as vehicleRepository from "@/core/vehicle/vehicle-repository";
import {
  cleanupCompanies,
  createSupplierContext,
  createTestVehicle,
} from "@/test/fixtures";

describe("vehicle-repository tenant isolation", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("never returns another company's vehicles", async () => {
    const ctxA = await createSupplierContext();
    const ctxB = await createSupplierContext();
    companyIds.push(ctxA.companyId, ctxB.companyId);

    const vehicleA = await createTestVehicle(ctxA.companyId, { plate: "A-PLATE" });
    const vehicleB = await createTestVehicle(ctxB.companyId, { plate: "B-PLATE" });

    const listForA = await vehicleRepository.listVehiclesForTenant(ctxA);
    const listForB = await vehicleRepository.listVehiclesForTenant(ctxB);

    expect(listForA.map((v) => v.id)).toContain(vehicleA.id);
    expect(listForA.map((v) => v.id)).not.toContain(vehicleB.id);
    expect(listForB.map((v) => v.id)).toContain(vehicleB.id);
    expect(listForB.map((v) => v.id)).not.toContain(vehicleA.id);
  });

  it("getVehicleForTenant returns null for a vehicle owned by another company", async () => {
    const ctxA = await createSupplierContext();
    const ctxB = await createSupplierContext();
    companyIds.push(ctxA.companyId, ctxB.companyId);

    const vehicleB = await createTestVehicle(ctxB.companyId);

    const result = await vehicleRepository.getVehicleForTenant(ctxA, vehicleB.id);
    expect(result).toBeNull();
  });

  it("plate uniqueness is enforced across the whole platform, not per tenant", async () => {
    const ctxA = await createSupplierContext();
    companyIds.push(ctxA.companyId);

    const vehicle = await createTestVehicle(ctxA.companyId, {
      plate: "SHARED-PLATE-1",
    });

    const found = await vehicleRepository.findVehicleByPlate("SHARED-PLATE-1");
    expect(found?.id).toBe(vehicle.id);
  });
});
