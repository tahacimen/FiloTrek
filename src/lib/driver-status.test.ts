import { describe, expect, it } from "vitest";

import { DriverStatus } from "@/generated/prisma/enums";
import {
  effectiveDriverStatus,
  isDriverAssignable,
  isOnLeave,
} from "@/lib/driver-status";

const base = {
  status: DriverStatus.AVAILABLE,
  isActive: true,
  leaveStartDate: null as Date | string | null,
  leaveEndDate: null as Date | string | null,
};

// A fixed "now" so the date math is deterministic regardless of when tests run.
const NOW = new Date("2026-06-15T10:00:00");

function daysFromNow(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  return d;
}

describe("effectiveDriverStatus", () => {
  it("is AVAILABLE for a plain active driver with no leave", () => {
    expect(effectiveDriverStatus(base, NOW)).toBe("AVAILABLE");
    expect(isDriverAssignable(base, NOW)).toBe(true);
  });

  it("is DEACTIVATED when inactive, outranking everything else", () => {
    expect(
      effectiveDriverStatus(
        { ...base, isActive: false, status: DriverStatus.ON_TRIP },
        NOW
      )
    ).toBe("DEACTIVATED");
    expect(isDriverAssignable({ ...base, isActive: false }, NOW)).toBe(false);
  });

  it("is ON_TRIP when the stored status is ON_TRIP (even if on leave)", () => {
    expect(
      effectiveDriverStatus(
        {
          ...base,
          status: DriverStatus.ON_TRIP,
          leaveStartDate: daysFromNow(-1),
          leaveEndDate: daysFromNow(1),
        },
        NOW
      )
    ).toBe("ON_TRIP");
  });

  it("is ON_LEAVE when today falls within the leave window", () => {
    expect(
      effectiveDriverStatus(
        { ...base, leaveStartDate: daysFromNow(-2), leaveEndDate: daysFromNow(2) },
        NOW
      )
    ).toBe("ON_LEAVE");
    expect(
      isDriverAssignable(
        { ...base, leaveStartDate: daysFromNow(-2), leaveEndDate: daysFromNow(2) },
        NOW
      )
    ).toBe(false);
  });

  it("leave is inclusive of the first and last day", () => {
    // Window is exactly today..today.
    expect(
      isOnLeave(
        { ...base, leaveStartDate: NOW, leaveEndDate: NOW },
        NOW
      )
    ).toBe(true);
  });

  it("reverts to the stored status once the leave window passes", () => {
    const expired = {
      ...base,
      status: DriverStatus.OFF_DUTY,
      leaveStartDate: daysFromNow(-10),
      leaveEndDate: daysFromNow(-5),
    };
    expect(effectiveDriverStatus(expired, NOW)).toBe("OFF_DUTY");
  });

  it("is OFF_DUTY when manually set and not on leave", () => {
    expect(
      effectiveDriverStatus({ ...base, status: DriverStatus.OFF_DUTY }, NOW)
    ).toBe("OFF_DUTY");
    expect(
      isDriverAssignable({ ...base, status: DriverStatus.OFF_DUTY }, NOW)
    ).toBe(false);
  });

  it("ON_LEAVE outranks a manual OFF_DUTY", () => {
    expect(
      effectiveDriverStatus(
        {
          ...base,
          status: DriverStatus.OFF_DUTY,
          leaveStartDate: daysFromNow(0),
          leaveEndDate: daysFromNow(3),
        },
        NOW
      )
    ).toBe("ON_LEAVE");
  });
});
