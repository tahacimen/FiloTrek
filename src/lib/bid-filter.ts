import type { ShipmentBidStatus } from "@/generated/prisma/enums";

/**
 * P2: the "Tekliflerim" filter set + summary, shared by the client filter bar
 * and the Excel-export route so the report matches the on-screen list. No
 * Prisma-client runtime import (only the lightweight generated enum type).
 */
export type MyBidFilters = {
  /** Free text matched against route and customer name. */
  q: string;
  /** "" means all. */
  status: ShipmentBidStatus | "";
  /** Bid createdAt lower bound, "YYYY-MM-DD" or "". */
  from: string;
  /** Bid createdAt upper bound, "YYYY-MM-DD" or "". */
  to: string;
};

export const EMPTY_MY_BID_FILTERS: MyBidFilters = {
  q: "",
  status: "",
  from: "",
  to: "",
};

export type FilterableBid = {
  createdAt: Date;
  status: ShipmentBidStatus;
  shipment: {
    originAddress: string;
    destinationAddress: string;
    customerCompany: { name: string } | null;
  };
};

function normalize(value: string): string {
  return value.toLocaleLowerCase("tr-TR");
}

export function bidMatchesFilters(
  bid: FilterableBid,
  filters: MyBidFilters
): boolean {
  const q = normalize(filters.q.trim());
  if (q) {
    const haystack = normalize(
      [
        bid.shipment.originAddress,
        bid.shipment.destinationAddress,
        bid.shipment.customerCompany?.name ?? "",
      ].join(" ")
    );
    if (!haystack.includes(q)) return false;
  }

  if (filters.status && bid.status !== filters.status) return false;

  const created = bid.createdAt.getTime();
  if (filters.from) {
    const fromMs = new Date(`${filters.from}T00:00:00`).getTime();
    if (!Number.isNaN(fromMs) && created < fromMs) return false;
  }
  if (filters.to) {
    const toMs = new Date(`${filters.to}T23:59:59.999`).getTime();
    if (!Number.isNaN(toMs) && created > toMs) return false;
  }

  return true;
}

export type BidSummary = {
  total: number;
  won: number;
  lost: number;
  pending: number;
  withdrawn: number;
  /** Won / (won + lost) as a 0–100 percent; 0 when nothing is decided yet. */
  winRate: number;
};

export function summarizeBids(bids: { status: ShipmentBidStatus }[]): BidSummary {
  let won = 0;
  let lost = 0;
  let pending = 0;
  let withdrawn = 0;
  for (const b of bids) {
    if (b.status === "ACCEPTED") won += 1;
    else if (b.status === "REJECTED") lost += 1;
    else if (b.status === "PENDING") pending += 1;
    else if (b.status === "WITHDRAWN") withdrawn += 1;
  }
  const decided = won + lost;
  return {
    total: bids.length,
    won,
    lost,
    pending,
    withdrawn,
    winRate: decided > 0 ? Math.round((won / decided) * 100) : 0,
  };
}

export function myBidFiltersToParams(filters: MyBidFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params;
}

export function myBidFiltersFromParams(params: URLSearchParams): MyBidFilters {
  return {
    q: params.get("q") ?? "",
    status: (params.get("status") as ShipmentBidStatus | null) ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };
}
