import ExcelJS from "exceljs";

import { shipmentBidStatusLabels, shipmentStatusLabels } from "@/lib/labels";
import type { FilterableBid } from "@/lib/bid-filter";
import type { ShipmentStatus } from "@/generated/prisma/enums";

/**
 * P2: build the .xlsx export of a supplier's own bids (the "Tekliflerim"
 * list), already filtered. Columns mirror the on-screen table plus the
 * winning company for lost bids and the shipment's current status.
 */
export type ExportableBid = FilterableBid & {
  price: { toString(): string };
  shipment: {
    originAddress: string;
    destinationAddress: string;
    tonnage: { toString(): string };
    status: ShipmentStatus;
    supplierCompanyId: string | null;
    customerCompany: { name: string } | null;
    supplierCompany: { name: string } | null;
  };
};

const COLUMNS = [
  "Tarih",
  "Çıkış",
  "Varış",
  "Müşteri",
  "Tonaj",
  "Teklifiniz (₺)",
  "Durum",
  "Kazanan Firma",
  "Sefer Durumu",
] as const;

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "short",
  timeStyle: "short",
});

export async function buildMyBidsExport(bids: ExportableBid[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Logigo";
  wb.created = new Date();

  const ws = wb.addWorksheet("Tekliflerim");
  ws.addRow(COLUMNS as unknown as string[]);
  ws.getRow(1).font = { bold: true };

  for (const bid of bids) {
    // Winner only meaningful for a lost bid (someone else took the shipment).
    const winner =
      bid.status === "REJECTED" ? bid.shipment.supplierCompany?.name ?? "" : "";
    ws.addRow([
      dateFormatter.format(bid.createdAt),
      bid.shipment.originAddress,
      bid.shipment.destinationAddress,
      bid.shipment.customerCompany?.name ?? "",
      bid.shipment.tonnage.toString(),
      bid.price.toString(),
      shipmentBidStatusLabels[bid.status],
      winner,
      shipmentStatusLabels[bid.shipment.status],
    ]);
  }

  ws.columns.forEach((col, i) => {
    const header = COLUMNS[i] ?? "";
    col.width = Math.max(header.length + 2, 14);
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
