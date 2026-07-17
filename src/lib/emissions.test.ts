import { describe, expect, it } from "vitest";

import { calculateShipmentEmissionsKg, VEHICLE_EMISSION_FACTORS } from "@/lib/emissions";
import { VehicleType } from "@/generated/prisma/client";

describe("calculateShipmentEmissionsKg", () => {
  it("multiplies distance x tonnage x the vehicle's gCO2e/tonne-km factor, converted to kg", () => {
    const kg = calculateShipmentEmissionsKg(500, 8, VehicleType.TIR);
    expect(kg).toBe((500 * 8 * VEHICLE_EMISSION_FACTORS[VehicleType.TIR]) / 1000);
  });

  it("scales linearly with distance and tonnage", () => {
    const base = calculateShipmentEmissionsKg(100, 1, VehicleType.KAMYON);
    const doubled = calculateShipmentEmissionsKg(200, 2, VehicleType.KAMYON);
    expect(doubled).toBe(base * 4);
  });

  it("uses a higher factor for smaller vehicle types, per tonne-km", () => {
    const tirKg = calculateShipmentEmissionsKg(100, 1, VehicleType.TIR);
    const vanKg = calculateShipmentEmissionsKg(100, 1, VehicleType.PANELVAN);
    expect(vanKg).toBeGreaterThan(tirKg);
  });
});
