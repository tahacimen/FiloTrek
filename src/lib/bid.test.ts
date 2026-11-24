import { describe, expect, it } from "vitest";

import {
  bidExpired,
  biddingDeadlinePassed,
  formatCountdown,
  isBiddingOpen,
  msUntilDeadline,
} from "@/lib/bid";

const NOW = new Date("2026-11-24T12:00:00Z").getTime();
const future = new Date(NOW + 2 * 3600_000); // +2h
const past = new Date(NOW - 3600_000); // -1h

describe("bid helpers", () => {
  it("biddingDeadlinePassed", () => {
    expect(biddingDeadlinePassed(null, NOW)).toBe(false);
    expect(biddingDeadlinePassed(future, NOW)).toBe(false);
    expect(biddingDeadlinePassed(past, NOW)).toBe(true);
  });

  it("isBiddingOpen: closed when awarded or deadline passed", () => {
    expect(
      isBiddingOpen({ supplierCompanyId: null, biddingDeadline: future }, NOW)
    ).toBe(true);
    expect(
      isBiddingOpen({ supplierCompanyId: null, biddingDeadline: null }, NOW)
    ).toBe(true);
    expect(
      isBiddingOpen({ supplierCompanyId: null, biddingDeadline: past }, NOW)
    ).toBe(false);
    expect(
      isBiddingOpen({ supplierCompanyId: "x", biddingDeadline: future }, NOW)
    ).toBe(false);
  });

  it("bidExpired", () => {
    expect(bidExpired(null, NOW)).toBe(false);
    expect(bidExpired(future, NOW)).toBe(false);
    expect(bidExpired(past, NOW)).toBe(true);
  });

  it("msUntilDeadline clamps at 0", () => {
    expect(msUntilDeadline(null, NOW)).toBeNull();
    expect(msUntilDeadline(future, NOW)).toBe(2 * 3600_000);
    expect(msUntilDeadline(past, NOW)).toBe(0);
  });

  it("formatCountdown", () => {
    expect(formatCountdown(0)).toBe("Süre doldu");
    expect(formatCountdown(90 * 60_000)).toBe("1s 30dk");
    expect(formatCountdown(26 * 3600_000)).toBe("1g 2s");
    expect(formatCountdown(5 * 60_000)).toBe("5dk");
  });
});
