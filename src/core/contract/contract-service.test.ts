import { afterAll, describe, expect, it } from "vitest";

import * as contractService from "@/core/contract/contract-service";
import { pickContractPrice } from "@/core/contract/contract-service";
import { createShipmentRequest } from "@/core/shipment/shipment-service";
import {
  cleanupCompanies,
  createCustomerContext,
  createSupplierContext,
} from "@/test/fixtures";
import { ContractPricingMethod } from "@/generated/prisma/client";

describe("pickContractPrice (G2 matcher)", () => {
  const params = {
    destinationProvince: "İzmir",
    destinationDistrict: "Kemalpaşa",
    distanceKm: 100,
    tonnage: 10,
  };

  it("returns null when no rate applies", () => {
    expect(pickContractPrice([], params)).toBeNull();
    expect(
      pickContractPrice(
        [
          {
            method: ContractPricingMethod.LANE_FIXED,
            destinationProvince: "Bursa",
            destinationDistrict: null,
            amount: 9999,
          },
        ],
        params
      )
    ).toBeNull();
  });

  it("computes per-km and per-ton", () => {
    expect(
      pickContractPrice(
        [{ method: ContractPricingMethod.PER_KM, destinationProvince: null, destinationDistrict: null, amount: 50 }],
        params
      )
    ).toBe(5000);
    expect(
      pickContractPrice(
        [{ method: ContractPricingMethod.PER_TON, destinationProvince: null, destinationDistrict: null, amount: 800 }],
        params
      )
    ).toBe(8000);
  });

  it("prefers the most specific rate (district lane > province lane > per-km > per-ton)", () => {
    const rates = [
      { method: ContractPricingMethod.PER_TON, destinationProvince: null, destinationDistrict: null, amount: 800 },
      { method: ContractPricingMethod.PER_KM, destinationProvince: null, destinationDistrict: null, amount: 50 },
      { method: ContractPricingMethod.LANE_FIXED, destinationProvince: "İzmir", destinationDistrict: null, amount: 4000 },
      { method: ContractPricingMethod.LANE_FIXED, destinationProvince: "İzmir", destinationDistrict: "Kemalpaşa", amount: 4500 },
    ];
    expect(pickContractPrice(rates, params)).toBe(4500);
  });
});

describe("contract-service auto-pricing (G2)", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("auto-fills and approves the price when a contract matches", async () => {
    const supplierCtx = await createSupplierContext();
    const customerCtx = await createCustomerContext();
    companyIds.push(supplierCtx.companyId, customerCtx.companyId);

    await contractService.createContractRate(supplierCtx, {
      customerCompanyId: customerCtx.companyId,
      method: ContractPricingMethod.PER_KM,
      destinationProvince: "",
      destinationDistrict: "",
      amount: "50",
    });

    const shipment = await createShipmentRequest(customerCtx, {
      supplierCompanyId: supplierCtx.companyId,
      originAddress: "İstanbul Tuzla",
      destinationAddress: "İzmir Kemalpaşa",
      destinationProvince: "İzmir",
      destinationDistrict: "Kemalpaşa",
      distanceKm: "100",
      tonnage: "10",
    });

    expect(shipment.agreedPrice?.toNumber()).toBe(5000);
    expect(shipment.priceApprovedAt).not.toBeNull();
    expect(shipment.priceProposedBy).toBe("SUPPLIER");
  });

  it("leaves the price open when no contract matches (normal negotiation)", async () => {
    const supplierCtx = await createSupplierContext();
    const customerCtx = await createCustomerContext();
    companyIds.push(supplierCtx.companyId, customerCtx.companyId);

    const shipment = await createShipmentRequest(customerCtx, {
      supplierCompanyId: supplierCtx.companyId,
      originAddress: "İstanbul",
      destinationAddress: "Ankara",
      distanceKm: "450",
      tonnage: "12",
    });

    expect(shipment.agreedPrice).toBeNull();
    expect(shipment.priceApprovedAt).toBeNull();
  });
});
