import { describe, expect, it } from "vitest";

import { PaymentStatus, ShipmentStatus } from "@/generated/prisma/enums";
import {
  EMPTY_SHIPMENT_FILTERS,
  shipmentFiltersFromParams,
  shipmentFiltersToParams,
  shipmentMatchesFilters,
  type FilterableShipment,
} from "@/lib/shipment-filter";

const base: FilterableShipment = {
  trackingNumber: 1042,
  originAddress: "İstanbul Tuzla",
  destinationAddress: "İzmir Bornova",
  status: ShipmentStatus.EN_ROUTE,
  paymentStatus: PaymentStatus.PENDING,
  createdAt: new Date("2026-10-15T10:00:00Z"),
  fromMarketplace: false,
  vehicle: { plate: "34 ABC 123" },
  driver: { fullName: "Ahmet Yılmaz" },
  customerCompany: { name: "Acme Lojistik" },
  supplierCompany: { name: "Hız Nakliyat" },
};

describe("shipmentMatchesFilters", () => {
  it("matches everything with empty filters", () => {
    expect(shipmentMatchesFilters(base, EMPTY_SHIPMENT_FILTERS)).toBe(true);
  });

  it("matches free text against tracking number, plate and firm (TR-insensitive)", () => {
    for (const q of ["1042", "34 abc", "ahmet", "izmir", "nakliyat"]) {
      expect(
        shipmentMatchesFilters(base, { ...EMPTY_SHIPMENT_FILTERS, q })
      ).toBe(true);
    }
    expect(
      shipmentMatchesFilters(base, { ...EMPTY_SHIPMENT_FILTERS, q: "ankara" })
    ).toBe(false);
  });

  it("filters by status and payment", () => {
    expect(
      shipmentMatchesFilters(base, {
        ...EMPTY_SHIPMENT_FILTERS,
        status: ShipmentStatus.EN_ROUTE,
      })
    ).toBe(true);
    expect(
      shipmentMatchesFilters(base, {
        ...EMPTY_SHIPMENT_FILTERS,
        status: ShipmentStatus.COMPLETED,
      })
    ).toBe(false);
    expect(
      shipmentMatchesFilters(base, {
        ...EMPTY_SHIPMENT_FILTERS,
        payment: PaymentStatus.PAID,
      })
    ).toBe(false);
  });

  it("filters by marketplace flag", () => {
    expect(
      shipmentMatchesFilters(base, {
        ...EMPTY_SHIPMENT_FILTERS,
        marketplace: "yes",
      })
    ).toBe(false);
    expect(
      shipmentMatchesFilters(
        { ...base, fromMarketplace: true },
        { ...EMPTY_SHIPMENT_FILTERS, marketplace: "yes" }
      )
    ).toBe(true);
    expect(
      shipmentMatchesFilters(base, {
        ...EMPTY_SHIPMENT_FILTERS,
        marketplace: "no",
      })
    ).toBe(true);
  });

  it("filters by inclusive created date range", () => {
    expect(
      shipmentMatchesFilters(base, {
        ...EMPTY_SHIPMENT_FILTERS,
        from: "2026-10-15",
        to: "2026-10-15",
      })
    ).toBe(true);
    expect(
      shipmentMatchesFilters(base, {
        ...EMPTY_SHIPMENT_FILTERS,
        from: "2026-10-16",
      })
    ).toBe(false);
    expect(
      shipmentMatchesFilters(base, {
        ...EMPTY_SHIPMENT_FILTERS,
        to: "2026-10-14",
      })
    ).toBe(false);
  });
});

describe("shipment filter params round-trip", () => {
  it("serializes and parses back, omitting empties", () => {
    const filters = {
      q: "izmir",
      status: ShipmentStatus.COMPLETED,
      payment: PaymentStatus.PAID,
      from: "2026-10-01",
      to: "2026-10-31",
      marketplace: "yes" as const,
    };
    const params = shipmentFiltersToParams(filters);
    expect(shipmentFiltersFromParams(params)).toEqual(filters);

    const empty = shipmentFiltersToParams(EMPTY_SHIPMENT_FILTERS);
    expect(empty.toString()).toBe("");
    expect(shipmentFiltersFromParams(empty)).toEqual(EMPTY_SHIPMENT_FILTERS);
  });

  it("drops a junk marketplace value", () => {
    const parsed = shipmentFiltersFromParams(
      new URLSearchParams("marketplace=maybe")
    );
    expect(parsed.marketplace).toBe("");
  });
});
