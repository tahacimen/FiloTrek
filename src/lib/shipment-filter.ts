import type { PaymentStatus, ShipmentStatus } from "@/generated/prisma/enums";

/**
 * S1: the Seferler/Seferlerim filter set, shared verbatim by the client filter
 * bar and the Excel-export route so the downloaded report always matches what
 * the user sees on screen. Deliberately free of any Prisma-client runtime
 * import (only the lightweight generated enum types) so the client component
 * can import it directly.
 */
export type ShipmentFilters = {
  /** Free text matched against tracking no, route, plate, driver and firm names. */
  q: string;
  /** "" means "all". */
  status: ShipmentStatus | "";
  /** "" means "all". */
  payment: PaymentStatus | "";
  /** createdAt lower bound, "YYYY-MM-DD" or "". */
  from: string;
  /** createdAt upper bound, "YYYY-MM-DD" or "". */
  to: string;
  /** "" all · "yes" only marketplace · "no" only non-marketplace. */
  marketplace: "" | "yes" | "no";
};

export const EMPTY_SHIPMENT_FILTERS: ShipmentFilters = {
  q: "",
  status: "",
  payment: "",
  from: "",
  to: "",
  marketplace: "",
};

/** The minimal shipment shape the predicate needs — both the table row and the
 * repository payload satisfy it structurally. */
export type FilterableShipment = {
  trackingNumber: number;
  originAddress: string;
  destinationAddress: string;
  status: ShipmentStatus;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  fromMarketplace: boolean;
  vehicle: { plate: string } | null;
  driver: { fullName: string } | null;
  customerCompany: { name: string } | null;
  supplierCompany: { name: string } | null;
};

/** Turkish-aware, accent-tolerant lowercasing for the free-text match. */
function normalize(value: string): string {
  return value.toLocaleLowerCase("tr-TR");
}

export function shipmentMatchesFilters(
  shipment: FilterableShipment,
  filters: ShipmentFilters
): boolean {
  const q = normalize(filters.q.trim());
  if (q) {
    const haystack = normalize(
      [
        shipment.trackingNumber.toString(),
        shipment.originAddress,
        shipment.destinationAddress,
        shipment.vehicle?.plate ?? "",
        shipment.driver?.fullName ?? "",
        shipment.customerCompany?.name ?? "",
        shipment.supplierCompany?.name ?? "",
      ].join(" ")
    );
    if (!haystack.includes(q)) return false;
  }

  if (filters.status && shipment.status !== filters.status) return false;
  if (filters.payment && shipment.paymentStatus !== filters.payment) {
    return false;
  }

  if (filters.marketplace === "yes" && !shipment.fromMarketplace) return false;
  if (filters.marketplace === "no" && shipment.fromMarketplace) return false;

  const created = shipment.createdAt.getTime();
  if (filters.from) {
    const fromMs = new Date(`${filters.from}T00:00:00`).getTime();
    if (!Number.isNaN(fromMs) && created < fromMs) return false;
  }
  if (filters.to) {
    // Inclusive of the whole "to" day.
    const toMs = new Date(`${filters.to}T23:59:59.999`).getTime();
    if (!Number.isNaN(toMs) && created > toMs) return false;
  }

  return true;
}

/** Serialize into URLSearchParams for the export link — omits empty fields. */
export function shipmentFiltersToParams(
  filters: ShipmentFilters
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.payment) params.set("payment", filters.payment);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.marketplace) params.set("marketplace", filters.marketplace);
  return params;
}

/** Parse back from a URLSearchParams (export route) — tolerant of junk. */
export function shipmentFiltersFromParams(
  params: URLSearchParams
): ShipmentFilters {
  const marketplace = params.get("marketplace");
  return {
    q: params.get("q") ?? "",
    status: (params.get("status") as ShipmentStatus | null) ?? "",
    payment: (params.get("payment") as PaymentStatus | null) ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    marketplace:
      marketplace === "yes" || marketplace === "no" ? marketplace : "",
  };
}
