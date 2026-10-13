import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { setShipmentPayment } from "@/core/shipment/shipment-payment";
import { NotFoundError } from "@/core/shared/errors";
import {
  cleanupCompanies,
  createCustomerContext,
  createSupplierContext,
  createTestCompany,
} from "@/test/fixtures";
import { CompanyType, ShipmentStatus } from "@/generated/prisma/client";

describe("shipment-payment", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  async function makeShipment() {
    const ctx = await createSupplierContext();
    const customer = await createTestCompany(CompanyType.CUSTOMER);
    companyIds.push(ctx.companyId, customer.id);
    const shipment = await prisma.shipment.create({
      data: {
        customerCompanyId: customer.id,
        supplierCompanyId: ctx.companyId,
        originAddress: "A",
        destinationAddress: "B",
        distanceKm: 100,
        tonnage: 5,
        status: ShipmentStatus.EN_ROUTE,
      },
    });
    return { ctx, shipment };
  }

  it("supplier marks a shipment paid with a due date, then reverts", async () => {
    const { ctx, shipment } = await makeShipment();

    const paid = await setShipmentPayment(ctx, shipment.id, {
      status: "PAID",
      dueDate: "2027-02-01",
    });
    expect(paid.paymentStatus).toBe("PAID");
    expect(paid.paidAt).not.toBeNull();
    expect(paid.paymentDueDate?.toISOString().slice(0, 10)).toBe("2027-02-01");

    const reverted = await setShipmentPayment(ctx, shipment.id, {
      status: "PENDING",
      dueDate: "2027-02-01",
    });
    expect(reverted.paymentStatus).toBe("PENDING");
    expect(reverted.paidAt).toBeNull();
  });

  it("rejects a customer trying to set payment", async () => {
    const { shipment } = await makeShipment();
    const customerCtx = await createCustomerContext();
    companyIds.push(customerCtx.companyId);
    await expect(
      setShipmentPayment(customerCtx, shipment.id, {
        status: "PAID",
        dueDate: "",
      })
    ).rejects.toThrow();
  });

  it("does not let another supplier touch a shipment it does not own", async () => {
    const { shipment } = await makeShipment();
    const otherSupplier = await createSupplierContext();
    companyIds.push(otherSupplier.companyId);
    await expect(
      setShipmentPayment(otherSupplier, shipment.id, {
        status: "PAID",
        dueDate: "",
      })
    ).rejects.toThrow(NotFoundError);
  });
});
