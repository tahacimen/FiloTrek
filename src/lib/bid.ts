/**
 * Spot bidding helpers shared by the server (bid gate) and the client
 * (countdown / comparison UI). Pure and dependency-free so both sides agree on
 * when bidding is closed. A marketplace shipment collects bids while it is
 * PENDING + unassigned; the optional deadline closes it early.
 */

/** True once the bidding deadline has passed (null deadline never closes). */
export function biddingDeadlinePassed(
  deadline: Date | null,
  now: number = Date.now()
): boolean {
  return deadline != null && deadline.getTime() <= now;
}

/** Whether new bids are still accepted for an open shipment. */
export function isBiddingOpen(
  shipment: { supplierCompanyId: string | null; biddingDeadline: Date | null },
  now: number = Date.now()
): boolean {
  if (shipment.supplierCompanyId != null) return false; // already awarded
  return !biddingDeadlinePassed(shipment.biddingDeadline, now);
}

/** True once a supplier's own offer has expired (its validUntil has passed). */
export function bidExpired(
  validUntil: Date | null,
  now: number = Date.now()
): boolean {
  return validUntil != null && validUntil.getTime() <= now;
}

/** Milliseconds left until the deadline, clamped at 0; null when no deadline. */
export function msUntilDeadline(
  deadline: Date | null,
  now: number = Date.now()
): number | null {
  if (deadline == null) return null;
  return Math.max(0, deadline.getTime() - now);
}

/**
 * Where a customer's marketplace request stands in its bidding lifecycle:
 * AWARDED (a supplier was chosen), CLOSED (deadline passed without an award),
 * COLLECTING (open, has at least one bid) or WAITING (open, no bids yet).
 */
export type MarketplaceRequestStatus =
  | "AWARDED"
  | "COLLECTING"
  | "WAITING"
  | "CLOSED";

export function marketplaceRequestStatus(
  req: {
    supplierCompanyId: string | null;
    biddingDeadline: Date | null;
    bidCount: number;
  },
  now: number = Date.now()
): MarketplaceRequestStatus {
  if (req.supplierCompanyId != null) return "AWARDED";
  if (biddingDeadlinePassed(req.biddingDeadline, now)) return "CLOSED";
  return req.bidCount > 0 ? "COLLECTING" : "WAITING";
}

export const marketplaceRequestStatusLabels: Record<
  MarketplaceRequestStatus,
  string
> = {
  AWARDED: "Karara Bağlandı",
  COLLECTING: "Teklif Toplanıyor",
  WAITING: "Teklif Bekleniyor",
  CLOSED: "Süre Doldu",
};

export const marketplaceRequestStatusBadge: Record<
  MarketplaceRequestStatus,
  "default" | "secondary" | "outline" | "destructive" | "success" | "warning"
> = {
  AWARDED: "success",
  COLLECTING: "default",
  WAITING: "warning",
  CLOSED: "secondary",
};

/** Compact "2g 4s 10dk" style remaining-time label from a millisecond span. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Süre doldu";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}g`);
  if (hours > 0) parts.push(`${hours}s`);
  // Always show minutes when under a day so a live countdown keeps moving.
  if (days === 0) parts.push(`${minutes}dk`);
  return parts.join(" ");
}
