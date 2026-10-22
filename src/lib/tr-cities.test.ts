import { describe, expect, it } from "vitest";

import {
  TR_PROVINCES,
  districtsOf,
  isValidDistrict,
  isValidProvince,
} from "@/lib/tr-cities";

describe("tr-cities dataset", () => {
  it("has all 81 provinces", () => {
    expect(TR_PROVINCES.length).toBe(81);
  });

  it("maps known province/district pairs", () => {
    expect(isValidProvince("İstanbul")).toBe(true);
    expect(isValidProvince("İzmir")).toBe(true);
    expect(districtsOf("İstanbul")).toContain("Kadıköy");
    expect(districtsOf("İzmir")).toContain("Kemalpaşa");
  });

  it("rejects a district from the wrong province", () => {
    expect(isValidDistrict("İzmir", "Kadıköy")).toBe(false);
    expect(isValidDistrict("İstanbul", "Kadıköy")).toBe(true);
  });

  it("rejects an unknown province", () => {
    expect(isValidProvince("Atlantis")).toBe(false);
    expect(districtsOf("Atlantis")).toEqual([]);
  });
});
