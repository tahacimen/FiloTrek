import { describe, expect, it } from "vitest";

import { ShipmentBidStatus } from "@/generated/prisma/enums";
import {
  bidMatchesFilters,
  EMPTY_MY_BID_FILTERS,
  myBidFiltersFromParams,
  myBidFiltersToParams,
  summarizeBids,
  type FilterableBid,
} from "@/lib/bid-filter";

const base: FilterableBid = {
  createdAt: new Date("2026-10-15T10:00:00Z"),
  status: ShipmentBidStatus.PENDING,
  shipment: {
    originAddress: "İstanbul Tuzla",
    destinationAddress: "İzmir Bornova",
    customerCompany: { name: "Acme Lojistik" },
  },
};

describe("bidMatchesFilters", () => {
  it("matches everything with empty filters", () => {
    expect(bidMatchesFilters(base, EMPTY_MY_BID_FILTERS)).toBe(true);
  });

  it("matches free text on route and customer (TR-insensitive)", () => {
    for (const q of ["izmir", "acme", "tuzla"]) {
      expect(bidMatchesFilters(base, { ...EMPTY_MY_BID_FILTERS, q })).toBe(true);
    }
    expect(bidMatchesFilters(base, { ...EMPTY_MY_BID_FILTERS, q: "ankara" })).toBe(
      false
    );
  });

  it("filters by status", () => {
    expect(
      bidMatchesFilters(base, {
        ...EMPTY_MY_BID_FILTERS,
        status: ShipmentBidStatus.PENDING,
      })
    ).toBe(true);
    expect(
      bidMatchesFilters(base, {
        ...EMPTY_MY_BID_FILTERS,
        status: ShipmentBidStatus.ACCEPTED,
      })
    ).toBe(false);
  });

  it("filters by inclusive created date range", () => {
    expect(
      bidMatchesFilters(base, { ...EMPTY_MY_BID_FILTERS, to: "2026-10-14" })
    ).toBe(false);
    expect(
      bidMatchesFilters(base, {
        ...EMPTY_MY_BID_FILTERS,
        from: "2026-10-15",
        to: "2026-10-15",
      })
    ).toBe(true);
  });
});

describe("summarizeBids", () => {
  it("counts outcomes and computes win rate over decided bids", () => {
    const s = summarizeBids([
      { status: ShipmentBidStatus.ACCEPTED },
      { status: ShipmentBidStatus.ACCEPTED },
      { status: ShipmentBidStatus.REJECTED },
      { status: ShipmentBidStatus.PENDING },
      { status: ShipmentBidStatus.WITHDRAWN },
    ]);
    expect(s).toEqual({
      total: 5,
      won: 2,
      lost: 1,
      pending: 1,
      withdrawn: 1,
      winRate: 67, // 2 / (2+1)
    });
  });

  it("win rate is 0 when nothing is decided", () => {
    expect(
      summarizeBids([{ status: ShipmentBidStatus.PENDING }]).winRate
    ).toBe(0);
  });
});

describe("my bid filter params round-trip", () => {
  it("serializes and parses back, omitting empties", () => {
    const filters = {
      q: "izmir",
      status: ShipmentBidStatus.ACCEPTED,
      from: "2026-10-01",
      to: "2026-10-31",
    };
    const params = myBidFiltersToParams(filters);
    expect(myBidFiltersFromParams(params)).toEqual(filters);

    const empty = myBidFiltersToParams(EMPTY_MY_BID_FILTERS);
    expect(empty.toString()).toBe("");
    expect(myBidFiltersFromParams(empty)).toEqual(EMPTY_MY_BID_FILTERS);
  });
});
