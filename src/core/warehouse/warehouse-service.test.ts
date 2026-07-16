import { afterAll, describe, expect, it } from "vitest";

import * as warehouseService from "@/core/warehouse/warehouse-service";
import { NotFoundError } from "@/core/shared/errors";
import {
  cleanupCompanies,
  createSupplierContext,
  createTestDock,
  createTestWarehouse,
} from "@/test/fixtures";

describe("warehouse-service", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("creates a warehouse and a dock with working hours end-to-end", async () => {
    const ctx = await createSupplierContext();
    companyIds.push(ctx.companyId);

    const warehouse = await warehouseService.createWarehouse(ctx, {
      name: "Merkez Depo",
    });
    expect(warehouse.name).toBe("Merkez Depo");

    const dock = await warehouseService.createDock(ctx, warehouse.id, {
      name: "Rampa 1",
      supportedReservationTypes: ["LOADING"],
      supportedVehicleTypes: ["TIR"],
      supportedBedTypes: ["TENTELI"],
      slotDurationMinutes: 45,
      workingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        isOpen: dayOfWeek !== 0,
        openTime: "08:00",
        closeTime: "17:00",
      })),
    });
    expect(dock.name).toBe("Rampa 1");
    expect(dock.slotDurationMinutes).toBe(45);
    expect(dock.workingHours).toHaveLength(7);
    expect(dock.workingHours.find((h) => h.dayOfWeek === 0)?.isOpen).toBe(false);

    const fetched = await warehouseService.getDock(ctx, dock.id);
    expect(fetched.id).toBe(dock.id);

    const updated = await warehouseService.updateDock(ctx, dock.id, {
      name: "Rampa 1 (güncellendi)",
      supportedReservationTypes: ["LOADING", "UNLOADING"],
      supportedVehicleTypes: ["TIR", "KAMYON"],
      supportedBedTypes: ["TENTELI"],
      slotDurationMinutes: 60,
      workingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        isOpen: true,
        openTime: "09:00",
        closeTime: "18:00",
      })),
    });
    expect(updated.name).toBe("Rampa 1 (güncellendi)");
    expect(updated.supportedReservationTypes).toEqual(["LOADING", "UNLOADING"]);
    expect(updated.workingHours.every((h) => h.isOpen)).toBe(true);
  });

  it("prevents a tenant from reading or modifying another tenant's warehouse/dock", async () => {
    const ctxA = await createSupplierContext();
    const ctxB = await createSupplierContext();
    companyIds.push(ctxA.companyId, ctxB.companyId);

    const warehouseA = await createTestWarehouse(ctxA.companyId);
    const dockA = await createTestDock(warehouseA.id);

    await expect(warehouseService.getDock(ctxB, dockA.id)).rejects.toThrow(
      NotFoundError
    );
    await expect(
      warehouseService.createDock(ctxB, warehouseA.id, {
        name: "Yabancı Rampa",
        supportedReservationTypes: ["LOADING"],
        supportedVehicleTypes: ["TIR"],
        supportedBedTypes: ["TENTELI"],
        slotDurationMinutes: 60,
        workingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          isOpen: true,
          openTime: "09:00",
          closeTime: "18:00",
        })),
      })
    ).rejects.toThrow(NotFoundError);
    await expect(
      warehouseService.updateDock(ctxB, dockA.id, {
        name: "Ele Geçirilmiş",
        supportedReservationTypes: ["LOADING"],
        supportedVehicleTypes: ["TIR"],
        supportedBedTypes: ["TENTELI"],
        slotDurationMinutes: 60,
        workingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          isOpen: true,
          openTime: "09:00",
          closeTime: "18:00",
        })),
      })
    ).rejects.toThrow(NotFoundError);
  });
});
