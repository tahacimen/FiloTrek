import { describe, expect, it } from "vitest";

import { LoadType, TransportMode } from "@/generated/prisma/enums";
import {
  loadTypesForMode,
  modeFields,
  shipmentStatusLabel,
  transportModeLabels,
  usesVehicleDriver,
} from "@/lib/transport-mode";

describe("transport-mode", () => {
  it("labels every mode", () => {
    expect(transportModeLabels[TransportMode.ROAD]).toBe("Karayolu");
    expect(transportModeLabels[TransportMode.SEA]).toBe("Denizyolu");
    expect(transportModeLabels[TransportMode.AIR]).toBe("Havayolu");
  });

  it("only road uses vehicle+driver", () => {
    expect(usesVehicleDriver(TransportMode.ROAD)).toBe(true);
    expect(usesVehicleDriver(TransportMode.SEA)).toBe(false);
    expect(usesVehicleDriver(TransportMode.AIR)).toBe(false);
  });

  it("offers mode-appropriate load types", () => {
    expect(loadTypesForMode(TransportMode.ROAD)).toEqual([
      LoadType.FTL,
      LoadType.LTL,
    ]);
    expect(loadTypesForMode(TransportMode.SEA)).toEqual([
      LoadType.FCL,
      LoadType.LCL,
    ]);
    expect(loadTypesForMode(TransportMode.AIR)).toEqual([]);
  });

  it("captures mode-specific reference fields", () => {
    expect(modeFields(TransportMode.ROAD)).toEqual([]);
    expect(modeFields(TransportMode.SEA)).toContain("bookingNumber");
    expect(modeFields(TransportMode.SEA)).toContain("containerNumber");
    expect(modeFields(TransportMode.AIR)).toContain("airwaybillNumber");
    expect(modeFields(TransportMode.AIR)).not.toContain("bookingNumber");
  });

  it("rewords in-transit status labels per mode but shares the terminal ones", () => {
    // In-transit legs reworded.
    expect(shipmentStatusLabel(TransportMode.SEA, "EN_ROUTE")).toBe(
      "Denizde (Yolda)"
    );
    expect(shipmentStatusLabel(TransportMode.AIR, "LOADING")).toBe(
      "Uçağa Yükleniyor"
    );
    // Road keeps the base label.
    expect(shipmentStatusLabel(TransportMode.ROAD, "EN_ROUTE")).toBe("Yolda");
    // Shared terminal states regardless of mode.
    expect(shipmentStatusLabel(TransportMode.SEA, "COMPLETED")).toBe(
      "Tamamlandı"
    );
    expect(shipmentStatusLabel(TransportMode.AIR, "PENDING")).toBe(
      "Atama Bekliyor"
    );
  });

  it("honors the customer-facing base labels for shared legs on road", () => {
    expect(
      shipmentStatusLabel(TransportMode.ROAD, "HEADING_TO_PICKUP", "CUSTOMER")
    ).toBe("Yüklemeye Geliyor");
  });
});
