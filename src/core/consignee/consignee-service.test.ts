import { afterAll, describe, expect, it } from "vitest";

import * as consigneeService from "@/core/consignee/consignee-service";
import {
  cleanupCompanies,
  createCustomerContext,
  createSupplierContext,
} from "@/test/fixtures";

describe("consignee-service (C1 cari)", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("creates, lists, edits and soft-removes a consignee", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);

    const created = await consigneeService.createConsignee(ctx, {
      title: "Kemalpaşa Gıda Ltd.",
      province: "İzmir",
      district: "Kemalpaşa",
      address: "OSB 3. Cadde",
      phone: "0232 000 00 00",
      taxNumber: "1234567890",
    });
    expect(created.province).toBe("İzmir");
    expect(created.district).toBe("Kemalpaşa");

    let list = await consigneeService.listConsignees(ctx);
    expect(list.map((c) => c.id)).toContain(created.id);

    await consigneeService.updateConsignee(ctx, created.id, {
      title: "Kemalpaşa Gıda A.Ş.",
      province: "İzmir",
      district: "Bornova",
      address: "",
      phone: "",
      taxNumber: "",
    });
    const edited = await consigneeService.getConsignee(ctx, created.id);
    expect(edited.title).toBe("Kemalpaşa Gıda A.Ş.");
    expect(edited.district).toBe("Bornova");

    await consigneeService.removeConsignee(ctx, created.id);
    list = await consigneeService.listConsignees(ctx);
    expect(list.map((c) => c.id)).not.toContain(created.id);
  });

  it("rejects a district that doesn't belong to the chosen province", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);

    await expect(
      consigneeService.createConsignee(ctx, {
        title: "Yanlış Cari",
        province: "İzmir",
        district: "Kadıköy", // Kadıköy is in İstanbul, not İzmir
        address: "",
        phone: "",
        taxNumber: "",
      })
    ).rejects.toThrow();
  });

  it("rejects an unknown province", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);

    await expect(
      consigneeService.createConsignee(ctx, {
        title: "Olmayan İl",
        province: "Atlantis",
        district: "Merkez",
        address: "",
        phone: "",
        taxNumber: "",
      })
    ).rejects.toThrow();
  });

  it("is customer-only (a supplier can't manage consignees)", async () => {
    const supplierCtx = await createSupplierContext();
    companyIds.push(supplierCtx.companyId);

    await expect(consigneeService.listConsignees(supplierCtx)).rejects.toThrow();
  });
});
