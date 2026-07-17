import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { dispatchShipmentStatusWebhook } from "@/core/integration/webhook-dispatch";
import { signWebhookPayload } from "@/lib/webhook-signing";
import * as companyRepository from "@/core/company/company-repository";
import {
  cleanupCompanies,
  createCustomerContext,
  createSupplierContext,
} from "@/test/fixtures";

describe("dispatchShipmentStatusWebhook", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does nothing for a company with no webhookUrl/webhookSecret configured", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await dispatchShipmentStatusWebhook(
      {
        id: "shipment-1",
        trackingNumber: 10000001,
        customerCompanyId: customerCtx.companyId,
        supplierCompanyId: supplierCtx.companyId,
      },
      "PENDING",
      "ASSIGNED"
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs a signed payload to whichever side(s) have a webhook configured", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    await companyRepository.setWebhookUrl(
      customerCtx.companyId,
      "https://customer.example.com/webhooks/logigo"
    );
    await companyRepository.setWebhookSecret(customerCtx.companyId, "customer-secret");
    // Supplier deliberately left unconfigured.

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await dispatchShipmentStatusWebhook(
      {
        id: "shipment-1",
        trackingNumber: 10000001,
        customerCompanyId: customerCtx.companyId,
        supplierCompanyId: supplierCtx.companyId,
      },
      "PENDING",
      "ASSIGNED"
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://customer.example.com/webhooks/logigo");
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      event: "shipment.status_changed",
      shipment_id: "shipment-1",
      tracking_number: 10000001,
      from_status: "PENDING",
      to_status: "ASSIGNED",
    });

    const expectedSignature = signWebhookPayload(init.body, "customer-secret");
    expect(init.headers["X-Logigo-Signature"]).toBe(expectedSignature);
  });

  it("never throws when the endpoint fails — best-effort only", async () => {
    const customerCtx = await createCustomerContext();
    const supplierCtx = await createSupplierContext();
    companyIds.push(customerCtx.companyId, supplierCtx.companyId);

    await companyRepository.setWebhookUrl(
      customerCtx.companyId,
      "https://unreachable.example.com/webhooks"
    );
    await companyRepository.setWebhookSecret(customerCtx.companyId, "secret");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network unreachable"))
    );
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      dispatchShipmentStatusWebhook(
        {
          id: "shipment-1",
          trackingNumber: 10000001,
          customerCompanyId: customerCtx.companyId,
          supplierCompanyId: supplierCtx.companyId,
        },
        "PENDING",
        "ASSIGNED"
      )
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
