import { describe, expect, it } from "vitest";

import {
  docExpiryStatus,
  docStatusLabel,
  vehicleNeedsDocAttention,
  vehicleWorstDocStatus,
} from "@/lib/vehicle-docs";

function inDays(n: number): Date {
  // Local midnight + n days, matching docExpiryStatus's start-of-today basis
  // so day counts are exact.
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

describe("docExpiryStatus", () => {
  it("returns none for a missing date", () => {
    expect(docExpiryStatus(null).status).toBe("none");
    expect(docExpiryStatus(undefined).status).toBe("none");
    expect(docExpiryStatus("").status).toBe("none");
  });

  it("flags a past date as expired", () => {
    expect(docExpiryStatus(inDays(-1)).status).toBe("expired");
  });

  it("flags a date within the soon window", () => {
    expect(docExpiryStatus(inDays(10)).status).toBe("soon");
    expect(docExpiryStatus(inDays(30)).status).toBe("soon");
  });

  it("treats a far future date as ok", () => {
    expect(docExpiryStatus(inDays(90)).status).toBe("ok");
  });

  it("accepts ISO strings (RSC-serialized dates)", () => {
    expect(docExpiryStatus(inDays(-5).toISOString()).status).toBe("expired");
  });
});

describe("vehicleWorstDocStatus / needsAttention", () => {
  it("reports the most urgent of the two documents", () => {
    expect(
      vehicleWorstDocStatus({
        inspectionExpiry: inDays(200),
        insuranceExpiry: inDays(-2),
      })
    ).toBe("expired");
    expect(
      vehicleWorstDocStatus({
        inspectionExpiry: inDays(15),
        insuranceExpiry: inDays(200),
      })
    ).toBe("soon");
  });

  it("needsAttention is true only for expired/soon", () => {
    expect(
      vehicleNeedsDocAttention({ inspectionExpiry: inDays(5), insuranceExpiry: null })
    ).toBe(true);
    expect(
      vehicleNeedsDocAttention({ inspectionExpiry: inDays(200), insuranceExpiry: null })
    ).toBe(false);
    expect(
      vehicleNeedsDocAttention({ inspectionExpiry: null, insuranceExpiry: null })
    ).toBe(false);
  });
});

describe("docStatusLabel", () => {
  it("renders human labels", () => {
    expect(docStatusLabel(null)).toBe("—");
    expect(docStatusLabel(inDays(-1))).toBe("Süresi doldu");
    expect(docStatusLabel(inDays(0))).toBe("Bugün doluyor");
    expect(docStatusLabel(inDays(12))).toBe("12 gün kaldı");
    expect(docStatusLabel(inDays(90))).toBe("Geçerli");
  });
});
