import { afterAll, describe, expect, it } from "vitest";

import * as vehicleService from "@/core/vehicle/vehicle-service";
import { setVehicleMaintenance } from "@/core/vehicle/vehicle-status";
import { ValidationError } from "@/core/shared/errors";
import {
  cleanupCompanies,
  createSupplierContext,
  createTestPhotoFile,
  createTestVehicle,
} from "@/test/fixtures";

/** A2: ruhsat photo is mandatory on create — a reusable valid upload. */
const ruhsat = () => createTestPhotoFile("ruhsat.jpg");

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
      registrationNumber: "AB123456",
      insurancePolicyNumber: "POL9988",
      inspectionExpiry: "2027-03-01",
      insuranceExpiry: "2027-01-15",
    }, ruhsat());
    expect(created.plate).toBe("34 SVC 001");
    expect(created.tonnageCapacity.toNumber()).toBe(20);

    await vehicleService.updateVehicle(ctx, created.id, {
      plate: "34 SVC 001",
      vehicleType: "TIR",
      bedType: "FRIGORIFIK",
      tonnageCapacity: "22.5",
      registrationNumber: "AB123456",
      insurancePolicyNumber: "POL9988",
      inspectionExpiry: "2027-03-01",
      insuranceExpiry: "2027-01-15",
    }, ruhsat());
    const edited = await vehicleService.getVehicle(ctx, created.id);
    expect(edited.bedType).toBe("FRIGORIFIK");
    expect(edited.tonnageCapacity.toNumber()).toBe(22.5);

    await vehicleService.deleteVehicle(ctx, created.id);
    await expect(vehicleService.getVehicle(ctx, created.id)).rejects.toThrow();
  });

  it("persists vehicle document fields and requires them (N1)", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    const created = await vehicleService.createVehicle(ctx, {
      plate: "34 DOC 001",
      vehicleType: "KAMYON",
      bedType: "KAPALI_KASA",
      tonnageCapacity: "10",
      registrationNumber: "AB123456",
      insurancePolicyNumber: "POL9988",
      inspectionExpiry: "2027-03-01",
      insuranceExpiry: "2027-01-15",
    }, ruhsat());
    expect(created.registrationNumber).toBe("AB123456");
    expect(created.insurancePolicyNumber).toBe("POL9988");
    expect(created.inspectionExpiry?.toISOString().slice(0, 10)).toBe("2027-03-01");
    expect(created.insuranceExpiry?.toISOString().slice(0, 10)).toBe("2027-01-15");

    // N1: document fields are now mandatory — blank values are rejected.
    await expect(
      vehicleService.updateVehicle(ctx, created.id, {
        plate: "34 DOC 001",
        vehicleType: "KAMYON",
        bedType: "KAPALI_KASA",
        tonnageCapacity: "10",
        registrationNumber: "",
        insurancePolicyNumber: "",
        inspectionExpiry: "",
        insuranceExpiry: "",
      })
    ).rejects.toThrow();

    // Creating a vehicle without documents is likewise rejected.
    await expect(
      vehicleService.createVehicle(ctx, {
        plate: "34 DOC 002",
        vehicleType: "KAMYON",
        bedType: "KAPALI_KASA",
        tonnageCapacity: "10",
      })
    ).rejects.toThrow();
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
        registrationNumber: "AB123456",
        insurancePolicyNumber: "POL9988",
        inspectionExpiry: "2027-03-01",
        insuranceExpiry: "2027-01-15",
      }, ruhsat())
    ).rejects.toThrow(ValidationError);
  });

  it("rejects creating a vehicle without a ruhsat photo (A2)", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    await expect(
      vehicleService.createVehicle(ctx, {
        plate: "34 NP 01",
        vehicleType: "KAMYON",
        bedType: "ACIK_KASA",
        tonnageCapacity: "10",
        registrationNumber: "AB123456",
        insurancePolicyNumber: "POL9988",
        inspectionExpiry: "2027-03-01",
        insuranceExpiry: "2027-01-15",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("validates the plate against the chosen country (A1)", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);
    const docs = {
      registrationNumber: "AB123456",
      insurancePolicyNumber: "POL9988",
      inspectionExpiry: "2027-03-01",
      insuranceExpiry: "2027-01-15",
      vehicleType: "KAMYON" as const,
      bedType: "ACIK_KASA" as const,
      tonnageCapacity: "10",
    };

    // TR default: a malformed Turkish plate is rejected (schema ZodError).
    await expect(
      vehicleService.createVehicle(ctx, { ...docs, plate: "ABCD" })
    ).rejects.toThrow();

    // TR: a valid plate is accepted and the country is stored.
    const tr = await vehicleService.createVehicle(
      ctx,
      { ...docs, plate: "34 ABC 123" },
      ruhsat()
    );
    expect(tr.country).toBe("TR");

    // Foreign country: lenient rule accepts a non-TR-format plate.
    const de = await vehicleService.createVehicle(
      ctx,
      { ...docs, country: "DE", plate: "B AB 1234" },
      ruhsat()
    );
    expect(de.country).toBe("DE");
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
