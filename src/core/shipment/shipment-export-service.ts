import ExcelJS from "exceljs";

import {
  paymentStatusLabels,
  shipmentStatusLabels,
} from "@/lib/labels";
import type { FilterableShipment } from "@/lib/shipment-filter";

/**
 * S1: build the .xlsx report for the (already filtered) Seferler list. The
 * columns mirror the on-screen table plus the tracking number and the raw
 * timestamps, so the file stands on its own as a report. Both company columns
 * are always included — a report is more useful with both parties named.
 */
export type ExportableShipment = FilterableShipment & {
  tonnage: { toString(): string };
  agreedPrice: { toString(): string } | null;
  priceApprovedAt: Date | null;
  paymentDueDate: Date | null;
  updatedAt: Date;
};

const COLUMNS = [
  "Takip No",
  "Müşteri",
  "Tedarikçi",
  "Çıkış",
  "Varış",
  "Tonaj",
  "Araç",
  "Şoför",
  "Fiyat (₺)",
  "Fiyat Onayı",
  "Ödeme",
  "Ödeme Vadesi",
  "Durum",
  "Pazaryeri",
  "Oluşturulma",
  "Güncelleme",
] as const;

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDate(date: Date | null): string {
  return date ? dateFormatter.format(date) : "";
}

export async function buildShipmentsExport(
  shipments: ExportableShipment[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Logigo";
  wb.created = new Date();

  const ws = wb.addWorksheet("Seferler");
  ws.addRow(COLUMNS as unknown as string[]);
  ws.getRow(1).font = { bold: true };

  for (const s of shipments) {
    ws.addRow([
      s.trackingNumber,
      s.customerCompany?.name ?? "",
      s.supplierCompany?.name ?? "",
      s.originAddress,
      s.destinationAddress,
      s.tonnage.toString(),
      s.vehicle?.plate ?? "",
      s.driver?.fullName ?? "",
      s.agreedPrice ? s.agreedPrice.toString() : "",
      s.agreedPrice ? (s.priceApprovedAt ? "Onaylı" : "Onay Bekliyor") : "",
      paymentStatusLabels[s.paymentStatus],
      formatDate(s.paymentDueDate),
      shipmentStatusLabels[s.status],
      s.fromMarketplace ? "Evet" : "Hayır",
      formatDate(s.createdAt),
      formatDate(s.updatedAt),
    ]);
  }

  // Reasonable auto-ish widths — ExcelJS has no true autofit.
  ws.columns.forEach((col, i) => {
    const header = COLUMNS[i] ?? "";
    col.width = Math.max(header.length + 2, 14);
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
