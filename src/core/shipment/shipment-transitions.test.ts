import { describe, expect, it } from "vitest";

import {
  canCancelShipment,
  getNextShipmentSteps,
  SHIPMENT_ALLOWED_TRANSITIONS,
  SHIPMENT_TO_VEHICLE_STATUS,
} from "@/core/shipment/shipment-transitions";
import { ShipmentStatus, VehicleStatus } from "@/generated/prisma/enums";

describe("SHIPMENT_ALLOWED_TRANSITIONS", () => {
  it("follows the sequential Müsait -> Atandı -> Yüklemeye Gidiyor -> Yüklemede -> Yüklemeye Hazır -> Yolda -> Teslimat Noktasında -> Tamamlandı flow", () => {
    expect(SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.PENDING]).toContain(
      ShipmentStatus.ASSIGNED
    );
    expect(SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.ASSIGNED]).toContain(
      ShipmentStatus.HEADING_TO_PICKUP
    );
    expect(
      SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.HEADING_TO_PICKUP]
    ).toContain(ShipmentStatus.LOADING);
    expect(SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.LOADING]).toContain(
      ShipmentStatus.AT_PICKUP_GATE
    );
    expect(
      SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.AT_PICKUP_GATE]
    ).toContain(ShipmentStatus.EN_ROUTE);
    expect(SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.EN_ROUTE]).toContain(
      ShipmentStatus.AT_DELIVERY_POINT
    );
    expect(
      SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.AT_DELIVERY_POINT]
    ).toContain(ShipmentStatus.COMPLETED);
  });

  it("never allows skipping a step", () => {
    expect(SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.PENDING]).not.toContain(
      ShipmentStatus.LOADING
    );
    // The headline regression case for this state: a shipment can no longer
    // jump straight from ASSIGNED to LOADING — it must pass through
    // HEADING_TO_PICKUP first (see the guard test in shipment-status.test.ts).
    expect(SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.ASSIGNED]).not.toContain(
      ShipmentStatus.LOADING
    );
    expect(SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.ASSIGNED]).not.toContain(
      ShipmentStatus.EN_ROUTE
    );
    expect(
      SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.HEADING_TO_PICKUP]
    ).not.toContain(ShipmentStatus.EN_ROUTE);
    // LOADING can no longer jump straight to EN_ROUTE — it must pass
    // through AT_PICKUP_GATE first.
    expect(SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.LOADING]).not.toContain(
      ShipmentStatus.EN_ROUTE
    );
    expect(SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.LOADING]).not.toContain(
      ShipmentStatus.AT_DELIVERY_POINT
    );
    expect(SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.EN_ROUTE]).not.toContain(
      ShipmentStatus.COMPLETED
    );
  });

  it("treats COMPLETED and CANCELLED as terminal", () => {
    expect(SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.COMPLETED]).toEqual([]);
    expect(SHIPMENT_ALLOWED_TRANSITIONS[ShipmentStatus.CANCELLED]).toEqual([]);
  });

  it("allows cancellation from every non-terminal status", () => {
    const nonTerminal = [
      ShipmentStatus.PENDING,
      ShipmentStatus.ASSIGNED,
      ShipmentStatus.HEADING_TO_PICKUP,
      ShipmentStatus.LOADING,
      ShipmentStatus.AT_PICKUP_GATE,
      ShipmentStatus.EN_ROUTE,
      ShipmentStatus.AT_DELIVERY_POINT,
    ];
    for (const status of nonTerminal) {
      expect(SHIPMENT_ALLOWED_TRANSITIONS[status]).toContain(
        ShipmentStatus.CANCELLED
      );
    }
  });
});

describe("getNextShipmentSteps", () => {
  it("excludes CANCELLED from the forward steps shown as primary action buttons", () => {
    expect(getNextShipmentSteps(ShipmentStatus.PENDING)).toEqual([
      ShipmentStatus.ASSIGNED,
    ]);
    expect(getNextShipmentSteps(ShipmentStatus.COMPLETED)).toEqual([]);
  });
});

describe("canCancelShipment", () => {
  it("is true for active shipments and false for terminal ones", () => {
    expect(canCancelShipment(ShipmentStatus.ASSIGNED)).toBe(true);
    expect(canCancelShipment(ShipmentStatus.COMPLETED)).toBe(false);
    expect(canCancelShipment(ShipmentStatus.CANCELLED)).toBe(false);
  });
});

describe("SHIPMENT_TO_VEHICLE_STATUS", () => {
  it("mirrors shipment progress statuses onto the matching vehicle status", () => {
    expect(SHIPMENT_TO_VEHICLE_STATUS[ShipmentStatus.ASSIGNED]).toBe(
      VehicleStatus.ASSIGNED
    );
    expect(SHIPMENT_TO_VEHICLE_STATUS[ShipmentStatus.HEADING_TO_PICKUP]).toBe(
      VehicleStatus.HEADING_TO_PICKUP
    );
    expect(SHIPMENT_TO_VEHICLE_STATUS[ShipmentStatus.LOADING]).toBe(
      VehicleStatus.LOADING
    );
    // Still at the loading site (no distinct VehicleStatus for the gate sub-step).
    expect(SHIPMENT_TO_VEHICLE_STATUS[ShipmentStatus.AT_PICKUP_GATE]).toBe(
      VehicleStatus.LOADING
    );
    expect(SHIPMENT_TO_VEHICLE_STATUS[ShipmentStatus.EN_ROUTE]).toBe(
      VehicleStatus.EN_ROUTE
    );
    expect(SHIPMENT_TO_VEHICLE_STATUS[ShipmentStatus.AT_DELIVERY_POINT]).toBe(
      VehicleStatus.AT_DELIVERY_POINT
    );
  });

  it("has no vehicle-status mapping for COMPLETED (handled as an explicit auto-release instead)", () => {
    expect(SHIPMENT_TO_VEHICLE_STATUS[ShipmentStatus.COMPLETED]).toBeUndefined();
  });
});
