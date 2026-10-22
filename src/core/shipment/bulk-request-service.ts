import ExcelJS from "exceljs";

import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { ValidationError } from "@/core/shared/errors";
import * as shipmentService from "@/core/shipment/shipment-service";
import { listSupplierCompanies } from "@/core/company/company-repository";
import { listWarehouses } from "@/core/warehouse/warehouse-service";
import { listConsignees } from "@/core/consignee/consignee-service";
import { computeRoadDistanceKm } from "@/lib/geo-distance";
import { CompanyType } from "@/generated/prisma/client";

// C3: the bulk "Toplu Araç Çağır" Excel contract. Column order is shared by
// the downloadable template and the parser so they can never drift.
const COLUMNS = [
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
] as const;

const SHEET_NAME = "Talepler";

/** A Turkish-aware normalized key for name matching (trim + locale lowercase). */
function norm(s: string): string {
  return s.trim().toLocaleLowerCase("tr-TR");
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    // Rich text / hyperlink / formula result shapes.
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (typeof o.text === "string") return o.text.trim();
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("").trim();
    if (o.result != null) return String(o.result).trim();
  }
  return "";
}

function isYes(s: string): boolean {
  const n = norm(s);
  return n === "e" || n === "evet" || n === "x" || n === "true" || n === "1";
}

export type BulkRowError = { row: number; message: string };
export type BulkResult = { created: number; errors: BulkRowError[] };

/**
 * Builds the downloadable .xlsx template: a header row, a filled example, and
 * a second "Açıklama" sheet documenting each column. Returned as a Buffer the
 * route handler streams back.
 */
export async function buildBulkTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Logigo";
  const ws = wb.addWorksheet(SHEET_NAME);
  ws.addRow(COLUMNS as unknown as string[]);
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c) => {
    c.width = 22;
  });
  // Example row (illustrative — users overwrite/remove it).
  ws.addRow([
    "",
    "Merkez Depo",
    "Kemalpaşa Gıda Ltd.",
    "",
    "",
    "",
    "18",
    "",
    "",
    "Paletli kuru gıda",
    "",
    "H",
    "",
    "H",
  ]);

  const help = wb.addWorksheet("Açıklama");
  help.getColumn(1).width = 26;
  help.getColumn(2).width = 80;
  help.addRow(["Kolon", "Açıklama"]);
  help.getRow(1).font = { bold: true };
  const notes: [string, string][] = [
    ["Tedarikçi Firma", "Kayıtlı tedarikçinin tam adı. BOŞ bırakılırsa talep pazara açılır (teklif toplanır)."],
    ["Yükleme Noktası", "Kayıtlı depo adı (eşleşirse adres/konum otomatik gelir) ya da düz bir adres metni. Zorunlu."],
    ["Cari Ünvanı", "Kayıtlı carinin ünvanı. Eşleşirse teslim il/ilçe otomatik gelir."],
    ["Teslim İl / İlçe / Adresi", "Cari ünvanı boşsa doldurun. İl ve ilçe birlikte girilmelidir."],
    ["Tonaj", "Sayısal, ton. Zorunlu."],
    ["Mesafe (km)", "Boş bırakılırsa yükleme–teslim arası otomatik hesaplanır. Sayısal."],
    ["En Geç Yükleme", "Opsiyonel. Tarih/saat (ör. 2026-10-25 14:00)."],
    ["Yük Açıklaması / Belge Takip No", "Opsiyonel."],
    ["Tehlikeli Madde (E/H)", "E ise ADR Sınıfı da girilmelidir."],
    ["Soğuk Zincir (E/H)", "Opsiyonel."],
  ];
  notes.forEach((n) => help.addRow(n));

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Parses an uploaded bulk-request workbook and creates a shipment request per
 * valid row, collecting per-row errors rather than failing the whole import.
 * Name references (supplier / loading point / cari) are resolved against the
 * customer's own data; missing km is auto-computed (best-effort).
 */
export async function parseAndCreateBulk(
  ctx: TenantContext,
  fileBuffer: ArrayBuffer | Buffer
): Promise<BulkResult> {
  requireCompanyType(ctx, CompanyType.CUSTOMER);

  const wb = new ExcelJS.Workbook();
  // exceljs's load() typing expects its own Buffer shape; a Node Buffer works
  // at runtime, so normalize an incoming ArrayBuffer and cast for the call.
  const data = Buffer.isBuffer(fileBuffer)
    ? fileBuffer
    : Buffer.from(new Uint8Array(fileBuffer));
  await wb.xlsx.load(data as unknown as ExcelJS.Buffer);
  const ws = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets[0];
  if (!ws) throw new ValidationError("Excel dosyasında okunabilir sayfa yok.");

  const [suppliers, warehouses, consignees] = await Promise.all([
    listSupplierCompanies(ctx.isDemo),
    listWarehouses(ctx),
    listConsignees(ctx),
  ]);
  const supplierByName = new Map(suppliers.map((s) => [norm(s.name), s]));
  const warehouseByName = new Map(warehouses.map((w) => [norm(w.name), w]));
  const consigneeByName = new Map(consignees.map((c) => [norm(c.title), c]));

  const errors: BulkRowError[] = [];
  let created = 0;

  // Collect the data rows first (skip the header on row 1); exceljs row
  // numbers are 1-based and match what the user sees in Excel.
  const rows: { rowNumber: number; cells: ExcelJS.Cell[] }[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    rows.push({
      rowNumber,
      cells: COLUMNS.map((_, i) => row.getCell(i + 1)),
    });
  });

  for (const { rowNumber, cells } of rows) {
    const [
      supplierName,
      loadingPoint,
      consigneeTitle,
      destProvince,
      destDistrict,
      destAddressText,
      tonnageText,
      kmText,
      latestLoadingText,
      cargoDescription,
      documentTrackingNumber,
      dangerousText,
      adrClass,
      coldChainText,
    ] = cells.map(cellText);

    // Skip fully-empty rows silently (common trailing blanks).
    if (cells.every((c) => cellText(c) === "")) continue;

    try {
      // Supplier: optional; a given name must resolve.
      let supplierCompanyId: string | undefined;
      if (supplierName) {
        const match = supplierByName.get(norm(supplierName));
        if (!match) {
          throw new ValidationError(`Tedarikçi bulunamadı: "${supplierName}".`);
        }
        supplierCompanyId = match.id;
      }

      // Loading point: a saved warehouse name, else free address text.
      if (!loadingPoint) throw new ValidationError("Yükleme noktası zorunlu.");
      const warehouse = warehouseByName.get(norm(loadingPoint));
      const originAddress = warehouse?.address ?? warehouse?.name ?? loadingPoint;
      const originMapsUrl = warehouse?.mapsUrl ?? undefined;

      // Destination: a saved cari (title) or an il/ilçe + address.
      let destinationAddress: string;
      let province: string | undefined;
      let district: string | undefined;
      const consignee = consigneeTitle
        ? consigneeByName.get(norm(consigneeTitle))
        : undefined;
      if (consigneeTitle && !consignee) {
        throw new ValidationError(`Cari bulunamadı: "${consigneeTitle}".`);
      }
      if (consignee) {
        province = consignee.province;
        district = consignee.district;
        destinationAddress = [
          consignee.title,
          `${consignee.district}/${consignee.province}`,
          consignee.address ?? "",
        ]
          .filter(Boolean)
          .join(" — ");
      } else if (destProvince && destDistrict) {
        province = destProvince;
        district = destDistrict;
        destinationAddress =
          destAddressText || `${destDistrict}/${destProvince}`;
      } else {
        throw new ValidationError(
          "Teslim noktası için ya Cari Ünvanı ya da Teslim İl + İlçe girin."
        );
      }

      if (!tonnageText) throw new ValidationError("Tonaj zorunlu.");

      // Distance: use the given value, else auto-compute (best-effort).
      let distanceKm = Number(kmText.replace(",", "."));
      if (!kmText || Number.isNaN(distanceKm) || distanceKm <= 0) {
        const originQuery = warehouse?.address ?? loadingPoint;
        const destQuery =
          province && district ? `${district} ${province}` : destinationAddress;
        const auto = await computeRoadDistanceKm(originQuery, destQuery);
        if (auto == null) {
          throw new ValidationError(
            "Mesafe otomatik hesaplanamadı — 'Mesafe (km)' sütununu doldurun."
          );
        }
        distanceKm = auto;
      }

      await shipmentService.createShipmentRequest(ctx, {
        supplierCompanyId,
        originAddress,
        originMapsUrl,
        destinationAddress,
        destinationProvince: province,
        destinationDistrict: district,
        distanceKm,
        tonnage: tonnageText,
        latestLoadingAt: latestLoadingText || undefined,
        cargoDescription: cargoDescription || undefined,
        documentTrackingNumber: documentTrackingNumber || undefined,
        isDangerousGoods: isYes(dangerousText),
        adrClass: adrClass || undefined,
        requiresColdChain: isYes(coldChainText),
      });
      created += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Bilinmeyen hata.";
      errors.push({ row: rowNumber, message });
    }
  }

  return { created, errors };
}
