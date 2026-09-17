import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  listCustomerCompanies,
  listSupplierCompanies,
} from "@/core/company/company-repository";
import { listOpenShipmentsForBidding } from "@/core/marketplace/marketplace-repository";
import { createShipmentRequest } from "@/core/shipment/shipment-service";
import {
  provisionDemoInstance,
  purgeDemoInstance,
  listDemoInstances,
  DEMO_TTL_DAYS,
} from "@/core/demo/demo-provision";
import { ShipmentStatus, CompanyType } from "@/generated/prisma/client";
import {
  cleanupCompanies,
  createTestCompany,
  createCustomerContext,
  createPlatformAdminContext,
} from "@/test/fixtures";

const trackedCompanies: string[] = [];
const trackedInstances: Array<{
  id: string;
  supplierCompanyId: string;
  customerCompanyId: string;
}> = [];

afterEach(async () => {
  for (const inst of trackedInstances.splice(0)) {
    await purgeDemoInstance(inst).catch(() => {});
  }
  if (trackedCompanies.length) {
    await cleanupCompanies(trackedCompanies.splice(0));
  }
});

describe("demo realm isolation", () => {
  it("supplier/customer pickers only return the caller's own realm", async () => {
    const realSupplier = await createTestCompany(CompanyType.SUPPLIER);
    const demoSupplier = await createTestCompany(CompanyType.SUPPLIER, {
      isDemo: true,
    });
    const realCustomer = await createTestCompany(CompanyType.CUSTOMER);
    const demoCustomer = await createTestCompany(CompanyType.CUSTOMER, {
      isDemo: true,
    });
    trackedCompanies.push(
      realSupplier.id,
      demoSupplier.id,
      realCustomer.id,
      demoCustomer.id
    );

    const realSuppliers = await listSupplierCompanies(false);
    const realSupplierIds = realSuppliers.map((c) => c.id);
    expect(realSupplierIds).toContain(realSupplier.id);
    expect(realSupplierIds).not.toContain(demoSupplier.id);

    const demoSuppliers = await listSupplierCompanies(true);
    const demoSupplierIds = demoSuppliers.map((c) => c.id);
    expect(demoSupplierIds).toContain(demoSupplier.id);
    expect(demoSupplierIds).not.toContain(realSupplier.id);

    const realCustomers = (await listCustomerCompanies(false)).map((c) => c.id);
    expect(realCustomers).toContain(realCustomer.id);
    expect(realCustomers).not.toContain(demoCustomer.id);

    const demoCustomers = (await listCustomerCompanies(true)).map((c) => c.id);
    expect(demoCustomers).toContain(demoCustomer.id);
    expect(demoCustomers).not.toContain(realCustomer.id);
  });

  it("the open marketplace pool is realm-scoped", async () => {
    const realCustomer = await createTestCompany(CompanyType.CUSTOMER);
    const demoCustomer = await createTestCompany(CompanyType.CUSTOMER, {
      isDemo: true,
    });
    const realSupplier = await createTestCompany(CompanyType.SUPPLIER);
    const demoSupplier = await createTestCompany(CompanyType.SUPPLIER, {
      isDemo: true,
    });
    trackedCompanies.push(
      realCustomer.id,
      demoCustomer.id,
      realSupplier.id,
      demoSupplier.id
    );

    const realOpen = await prisma.shipment.create({
      data: {
        customerCompanyId: realCustomer.id,
        originAddress: "İstanbul",
        destinationAddress: "İzmir",
        distanceKm: 480,
        tonnage: 10,
        status: ShipmentStatus.PENDING,
      },
    });
    const demoOpen = await prisma.shipment.create({
      data: {
        customerCompanyId: demoCustomer.id,
        originAddress: "Ankara",
        destinationAddress: "İzmir",
        distanceKm: 580,
        tonnage: 10,
        status: ShipmentStatus.PENDING,
      },
    });

    const realPool = (await listOpenShipmentsForBidding(realSupplier.id, false)).map(
      (s) => s.id
    );
    expect(realPool).toContain(realOpen.id);
    expect(realPool).not.toContain(demoOpen.id);

    const demoPool = (await listOpenShipmentsForBidding(demoSupplier.id, true)).map(
      (s) => s.id
    );
    expect(demoPool).toContain(demoOpen.id);
    expect(demoPool).not.toContain(realOpen.id);
  });

  it("a real customer cannot address a demo supplier (cross-realm guard)", async () => {
    const ctx = await createCustomerContext();
    trackedCompanies.push(ctx.companyId);
    const demoSupplier = await createTestCompany(CompanyType.SUPPLIER, {
      isDemo: true,
    });
    trackedCompanies.push(demoSupplier.id);

    await expect(
      createShipmentRequest(ctx, {
        originAddress: "İstanbul",
        destinationAddress: "İzmir",
        distanceKm: 480,
        tonnage: 10,
        supplierCompanyId: demoSupplier.id,
      })
    ).rejects.toThrow(/Geçersiz tedarikçi/);
  });
});

describe("provisionDemoInstance", () => {
  it("builds an isolated, time-limited sandbox world and tears it down", async () => {
    const ctx = await createPlatformAdminContext();
    trackedCompanies.push(ctx.companyId);

    const instance = await provisionDemoInstance(ctx, {
      companyLabel: "Test Firma",
    });
    trackedInstances.push(instance);

    // Two demo companies, both flagged isDemo.
    const supplier = await prisma.company.findUnique({
      where: { id: instance.supplierCompanyId },
    });
    const customer = await prisma.company.findUnique({
      where: { id: instance.customerCompanyId },
    });
    expect(supplier?.isDemo).toBe(true);
    expect(customer?.isDemo).toBe(true);
    expect(supplier?.type).toBe(CompanyType.SUPPLIER);
    expect(customer?.type).toBe(CompanyType.CUSTOMER);

    // Demo users carry a magic-link token and a ~7-day expiry.
    const supplierUser = await prisma.user.findUnique({
      where: { id: instance.supplierUserId },
    });
    expect(supplierUser?.isDemo).toBe(true);
    expect(supplierUser?.demoLoginToken).toBe(instance.supplierToken);
    const days =
      (supplierUser!.demoExpiresAt!.getTime() - Date.now()) /
      (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(DEMO_TTL_DAYS - 0.1);
    expect(days).toBeLessThan(DEMO_TTL_DAYS + 0.1);

    // The demo supplier appears only in the demo realm's customer picker.
    const demoSuppliers = (await listSupplierCompanies(true)).map((c) => c.id);
    expect(demoSuppliers).toContain(instance.supplierCompanyId);
    const realSuppliers = (await listSupplierCompanies(false)).map((c) => c.id);
    expect(realSuppliers).not.toContain(instance.supplierCompanyId);

    // Sample data is present and scoped to the demo companies.
    const shipmentCount = await prisma.shipment.count({
      where: { customerCompanyId: instance.customerCompanyId },
    });
    expect(shipmentCount).toBeGreaterThan(0);

    // It shows up in the owner's instance list.
    const instances = await listDemoInstances(ctx);
    expect(instances.map((i) => i.id)).toContain(instance.id);

    // Purge removes the whole world.
    await purgeDemoInstance(instance);
    trackedInstances.length = 0;
    expect(
      await prisma.company.findUnique({ where: { id: instance.supplierCompanyId } })
    ).toBeNull();
    expect(
      await prisma.demoInstance.findUnique({ where: { id: instance.id } })
    ).toBeNull();
    expect(
      await prisma.shipment.count({
        where: { customerCompanyId: instance.customerCompanyId },
      })
    ).toBe(0);
  });
});
