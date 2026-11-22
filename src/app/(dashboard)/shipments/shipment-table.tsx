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
  paymentStatusBadgeVariant,
  paymentStatusLabels,
  statusBadgeVariant,
} from "@/lib/labels";
import {
  shipmentStatusLabel,
  transportModeLabels,
} from "@/lib/transport-mode";
import { formatDateTime } from "@/lib/format";
import { Plane, Ship } from "lucide-react";
import { TransportMode } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type ShipmentRow = Prisma.ShipmentGetPayload<{
  include: {
    customerCompany: { select: { id: true; name: true } };
    supplierCompany: { select: { id: true; name: true } };
    vehicle: { select: { id: true; plate: true; vehicleType: true } };
    driver: { select: { id: true; fullName: true; phone: true } };
  };
}>;

export function ShipmentTable({
  shipments,
  viewerCompanyType,
  emptyMessage = "Henüz sefer bulunmuyor.",
}: {
  shipments: ShipmentRow[];
  viewerCompanyType: "SUPPLIER" | "CUSTOMER";
  emptyMessage?: string;
}) {
  if (shipments.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        {emptyMessage}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            {viewerCompanyType === "SUPPLIER" ? "Müşteri" : "Tedarikçi"}
          </TableHead>
          <TableHead>Güzergah</TableHead>
          <TableHead>Tonaj</TableHead>
          <TableHead>Araç / Taşıyıcı</TableHead>
          <TableHead>Şoför / Referans</TableHead>
          <TableHead>Fiyat</TableHead>
          <TableHead>Ödeme</TableHead>
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
              <div className="flex flex-col gap-1">
                <span>
                  {shipment.originAddress} → {shipment.destinationAddress}
                </span>
                {(shipment.transportMode !== TransportMode.ROAD ||
                  shipment.fromMarketplace ||
                  shipment.isDangerousGoods ||
                  shipment.requiresColdChain) && (
                  <div className="flex flex-wrap gap-1.5">
                    {shipment.transportMode === TransportMode.SEA && (
                      <Badge variant="outline" className="gap-1 text-[11px]">
                        <Ship className="size-3" />
                        {transportModeLabels[TransportMode.SEA]}
                      </Badge>
                    )}
                    {shipment.transportMode === TransportMode.AIR && (
                      <Badge variant="outline" className="gap-1 text-[11px]">
                        <Plane className="size-3" />
                        {transportModeLabels[TransportMode.AIR]}
                      </Badge>
                    )}
                    {shipment.fromMarketplace && (
                      <Badge variant="secondary" className="text-[11px]">
                        Pazaryeri
                      </Badge>
                    )}
                    {shipment.isDangerousGoods && (
                      <Badge variant="destructive" className="text-[11px]">
                        Tehlikeli Madde
                      </Badge>
                    )}
                    {shipment.requiresColdChain && (
                      <Badge variant="outline" className="text-[11px]">
                        Soğuk Zincir
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>{shipment.tonnage.toString()} ton</TableCell>
            <TableCell>
              {shipment.transportMode === TransportMode.ROAD
                ? (shipment.vehicle?.plate ?? "—")
                : (shipment.carrierName ?? "—")}
            </TableCell>
            <TableCell>
              {shipment.transportMode === TransportMode.ROAD ? (
                shipment.driver ? (
                  <div className="flex flex-col">
                    <span>{shipment.driver.fullName}</span>
                    {shipment.driver.phone && (
                      <span className="text-muted-foreground text-xs">
                        {shipment.driver.phone}
                      </span>
                    )}
                  </div>
                ) : (
                  "—"
                )
              ) : (
                // Sea → container no, Air → AWB no (the key reference).
                (shipment.transportMode === TransportMode.SEA
                  ? shipment.containerNumber
                  : shipment.airwaybillNumber) ?? "—"
              )}
            </TableCell>
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
                <Badge variant={paymentStatusBadgeVariant[shipment.paymentStatus]}>
                  {paymentStatusLabels[shipment.paymentStatus]}
                </Badge>
                {shipment.paymentStatus === "PENDING" &&
                  shipment.paymentDueDate && (
                    <span className="text-muted-foreground text-xs">
                      Vade:{" "}
                      {new Date(shipment.paymentDueDate).toLocaleDateString(
                        "tr-TR"
                      )}
                    </span>
                  )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <Badge variant={statusBadgeVariant[shipment.status]}>
                    {shipmentStatusLabel(
                      shipment.transportMode,
                      shipment.status,
                      viewerCompanyType
                    )}
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
