import { afterAll, describe, expect, it } from "vitest";

import * as vehicleService from "@/core/vehicle/vehicle-service";
import { setVehicleMaintenance } from "@/core/vehicle/vehicle-status";
import { ValidationError } from "@/core/shared/errors";
import {
  cleanupCompanies,
  createSupplierContext,
  createTestVehicle,
} from "@/test/fixtures";

describe("vehicle-service", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("creates, edits and deletes a vehicle end-to-end", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    const created = await vehicleService.createVehicle(ctx, {
      plate: "34 SVC 001",
      vehicleType: "TIR",
      bedType: "TENTELI",
      tonnageCapacity: "20",
    });
    expect(created.plate).toBe("34 SVC 001");
    expect(created.tonnageCapacity.toNumber()).toBe(20);

    await vehicleService.updateVehicle(ctx, created.id, {
      plate: "34 SVC 001",
      vehicleType: "TIR",
      bedType: "FRIGORIFIK",
      tonnageCapacity: "22.5",
    });
    const edited = await vehicleService.getVehicle(ctx, created.id);
    expect(edited.bedType).toBe("FRIGORIFIK");
    expect(edited.tonnageCapacity.toNumber()).toBe(22.5);

    await vehicleService.deleteVehicle(ctx, created.id);
    await expect(vehicleService.getVehicle(ctx, created.id)).rejects.toThrow();
  });

  it("persists and clears vehicle document fields", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    const created = await vehicleService.createVehicle(ctx, {
      plate: "34 DOC 001",
      vehicleType: "KAMYON",
      bedType: "KAPALI_KASA",
      tonnageCapacity: "10",
      registrationNumber: "AB123456",
      insurancePolicyNumber: "POL-9988",
      inspectionExpiry: "2027-03-01",
      insuranceExpiry: "2027-01-15",
    });
    expect(created.registrationNumber).toBe("AB123456");
    expect(created.insurancePolicyNumber).toBe("POL-9988");
    expect(created.inspectionExpiry?.toISOString().slice(0, 10)).toBe("2027-03-01");
    expect(created.insuranceExpiry?.toISOString().slice(0, 10)).toBe("2027-01-15");

    // Empty strings clear the fields back to null.
    await vehicleService.updateVehicle(ctx, created.id, {
      plate: "34 DOC 001",
      vehicleType: "KAMYON",
      bedType: "KAPALI_KASA",
      tonnageCapacity: "10",
      registrationNumber: "",
      insurancePolicyNumber: "",
      inspectionExpiry: "",
      insuranceExpiry: "",
    });
    const cleared = await vehicleService.getVehicle(ctx, created.id);
    expect(cleared.registrationNumber).toBeNull();
    expect(cleared.inspectionExpiry).toBeNull();
    expect(cleared.insuranceExpiry).toBeNull();
  });

  it("rejects creating a vehicle with a plate already used by another company", async () => {
    const ctxA = await createSupplierContext();
    const ctxB = await createSupplierContext();
    companyIds.push(ctxA.companyId, ctxB.companyId);
    await createTestVehicle(ctxA.companyId, { plate: "34 DUP 001" });

    await expect(
      vehicleService.createVehicle(ctxB, {
        plate: "34 DUP 001",
        vehicleType: "KAMYON",
        bedType: "ACIK_KASA",
        tonnageCapacity: "10",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("allows maintenance for an available vehicle and returns it to available", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const vehicle = await createTestVehicle(ctx.companyId);

    const inMaintenance = await setVehicleMaintenance(ctx, vehicle.id, true);
    expect(inMaintenance.status).toBe("MAINTENANCE");

    const counts = await vehicleService.getFleetStatusCounts(ctx);
    expect(counts.MAINTENANCE).toBe(1);

    const backToAvailable = await setVehicleMaintenance(ctx, vehicle.id, false);
    expect(backToAvailable.status).toBe("AVAILABLE");
  });
});
