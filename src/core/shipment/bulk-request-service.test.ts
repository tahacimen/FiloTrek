import { afterAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import {
  buildBulkTemplate,
  parseAndCreateBulk,
} from "@/core/shipment/bulk-request-service";
import * as consigneeService from "@/core/consignee/consignee-service";
import { listShipments } from "@/core/shipment/shipment-service";
import {
  cleanupCompanies,
  createCustomerContext,
} from "@/test/fixtures";

// Column order mirrors COLUMNS in bulk-request-service.ts.
function buildWorkbookBuffer(rows: (string | number)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Talepler");
  ws.addRow([
    "Tedarikçi Firma",
    "Yükleme Noktası",
    "Cari Ünvanı",
    "Teslim İl",
    "Teslim İlçe",
    "Teslim Adresi",
    "Tonaj",
    "Mesafe (km)",
    "En Geç Yükleme",
    "Yük Açıklaması",
    "Belge Takip No",
    "Tehlikeli Madde (E/H)",
    "ADR Sınıfı",
    "Soğuk Zincir (E/H)",
  ]);
  rows.forEach((r) => ws.addRow(r));
  return wb.xlsx.writeBuffer().then((b) => Buffer.from(b));
}

describe("bulk-request-service (C3)", () => {
  const companyIds: string[] = [];
  afterAll(async () => {
    await cleanupCompanies(companyIds);
  });

  it("builds a non-empty .xlsx template", async () => {
    const buf = await buildBulkTemplate();
    expect(buf.length).toBeGreaterThan(0);
    // XLSX files are ZIP archives — first two bytes are "PK".
    expect(buf.slice(0, 2).toString("latin1")).toBe("PK");
  });

  it("creates valid rows and reports invalid ones", async () => {
    const ctx = await createCustomerContext();
    companyIds.push(ctx.companyId);

    await consigneeService.createConsignee(ctx, {
      title: "Test Cari",
      province: "İzmir",
      district: "Kemalpaşa",
      address: "",
      phone: "",
      taxNumber: "",
    });

    const buffer = await buildWorkbookBuffer([
      // Valid: free-text loading point, known cari, explicit km (no geocoding).
      ["", "İstanbul Tuzla OSB", "Test Cari", "", "", "", "10", "400", "", "", "", "", "", ""],
      // Invalid: unknown cari AND no il/ilçe fallback.
      ["", "İstanbul Tuzla OSB", "Olmayan Cari", "", "", "", "10", "400", "", "", "", "", "", ""],
      // Invalid: no cari and no il/ilçe.
      ["", "İstanbul Tuzla OSB", "", "", "", "", "10", "400", "", "", "", "", "", ""],
      // Invalid: missing tonnage.
      ["", "İstanbul Tuzla OSB", "Test Cari", "", "", "", "", "400", "", "", "", "", "", ""],
      // Valid (forgiving): unknown cari name, but explicit il/ilçe is given.
      ["", "İstanbul Tuzla OSB", "Yeni Alıcı Ltd.", "İzmir", "Kemalpaşa", "", "12", "400", "", "", "", "", "", ""],
    ]);

    const result = await parseAndCreateBulk(ctx, buffer);
    expect(result.created).toBe(2);
    expect(result.errors.length).toBe(3);
    // Errors reference the user-visible row numbers (header is row 1).
    expect(result.errors.map((e) => e.row).sort()).toEqual([3, 4, 5]);

    const shipments = await listShipments(ctx);
    expect(shipments.length).toBe(2);
    // Both land in İzmir/Kemalpaşa (cari-based and il/ilçe-based).
    expect(
      shipments.every(
        (s) => s.destinationProvince === "İzmir" && s.destinationDistrict === "Kemalpaşa"
      )
    ).toBe(true);
  });
});
