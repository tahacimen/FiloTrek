import { afterAll, describe, expect, it } from "vitest";

import { GET as listShipmentsHandler } from "@/app/api/v1/shipments/route";
import { GET as getShipmentHandler } from "@/app/api/v1/shipments/[id]/route";
import * as companyService from "@/core/company/company-service";
import * as shipmentService from "@/core/shipment/shipment-service";
import {
  cleanupCompanies,
  createCustomerContext,
  createSupplierContext,
} from "@/test/fixtures";

const baseFields = {
  originAddress: "İstanbul",
  destinationAddress: "Ankara",
  distanceKm: "500",
  tonnage: "8",
};

function requestWithBearer(token: string) {
  return new Request("https://example.com/api/v1/shipments", {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("GET /api/v1/shipments", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("lists shipments visible to the API-key company, serialized for the public API", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);
    const apiKey = await companyService.generateApiKey(customerCtx);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
    });

    const response = await listShipmentsHandler(requestWithBearer(apiKey));
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.shipments).toHaveLength(1);
    expect(body.shipments[0]).toMatchObject({
      id: shipment.id,
      status: "PENDING",
      origin_address: "İstanbul",
      distance_km: 500,
      tonnage: 8,
    });
  });

  it("returns 401 for a missing/invalid API key", async () => {
    const response = await listShipmentsHandler(
      new Request("https://example.com/api/v1/shipments")
    );
    expect(response.status).toBe(401);
  });
});

describe("GET /api/v1/shipments/[id]", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("returns the shipment when it belongs to the API-key company", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);
    const apiKey = await companyService.generateApiKey(supplierCtx);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
    });

    const response = await getShipmentHandler(requestWithBearer(apiKey), {
      params: Promise.resolve({ id: shipment.id }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(shipment.id);
  });

  it("returns 404 for a shipment belonging to a different company", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    const otherSupplierCtx = await createSupplierContext();
    companyIds.push(
      customerCtx.companyId,
      supplierCtx.companyId,
      otherSupplierCtx.companyId
    );
    const otherApiKey = await companyService.generateApiKey(otherSupplierCtx);

    const shipment = await shipmentService.createShipmentRequest(customerCtx, {
      ...baseFields,
      supplierCompanyId: supplierCtx.companyId,
    });

    const response = await getShipmentHandler(requestWithBearer(otherApiKey), {
      params: Promise.resolve({ id: shipment.id }),
    });
    expect(response.status).toBe(404);
  });
});
