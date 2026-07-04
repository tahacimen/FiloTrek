import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  customerShipmentStatusLabels,
  shipmentStatusLabels,
  statusBadgeVariant,
} from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

type ShipmentRow = Prisma.ShipmentGetPayload<{
  include: {
    customerCompany: { select: { id: true; name: true } };
    supplierCompany: { select: { id: true; name: true } };
    vehicle: { select: { id: true; plate: true; vehicleType: true } };
    driver: { select: { id: true; fullName: true } };
  };
}>;

export function ShipmentTable({
  shipments,
  viewerCompanyType,
}: {
  shipments: ShipmentRow[];
  viewerCompanyType: "SUPPLIER" | "CUSTOMER";
}) {
  if (shipments.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Henüz sefer bulunmuyor.
      </p>
    );
  }

  const statusLabels =
    viewerCompanyType === "CUSTOMER"
      ? customerShipmentStatusLabels
      : shipmentStatusLabels;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            {viewerCompanyType === "SUPPLIER" ? "Müşteri" : "Tedarikçi"}
          </TableHead>
          <TableHead>Güzergah</TableHead>
          <TableHead>Tonaj</TableHead>
          <TableHead>Araç</TableHead>
          <TableHead>Fiyat</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {shipments.map((shipment) => (
          <TableRow key={shipment.id}>
            <TableCell className="font-medium">
              {viewerCompanyType === "SUPPLIER"
                ? shipment.customerCompany.name
                : (shipment.supplierCompany?.name ?? "Henüz atanmadı")}
            </TableCell>
            <TableCell>
              {shipment.originAddress} → {shipment.destinationAddress}
            </TableCell>
            <TableCell>{shipment.tonnage.toString()} ton</TableCell>
            <TableCell>{shipment.vehicle?.plate ?? "—"}</TableCell>
            <TableCell>
              {shipment.agreedPrice ? (
                <span className="flex items-center gap-1.5">
                  {shipment.agreedPrice.toString()} ₺
                  {!shipment.priceApprovedAt && (
                    <Badge variant="warning">Onay Bekliyor</Badge>
                  )}
                </span>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <Badge variant={statusBadgeVariant[shipment.status]}>
                    {statusLabels[shipment.status]}
                  </Badge>
                  {shipment.hasOpenIncident && (
                    <Badge variant="destructive">Arıza</Badge>
                  )}
                </div>
                <span className="text-muted-foreground text-xs">
                  {formatDateTime(shipment.updatedAt)}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Link
                href={`/shipments/${shipment.id}`}
                className="text-primary text-sm font-medium hover:underline"
              >
                Detay
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
