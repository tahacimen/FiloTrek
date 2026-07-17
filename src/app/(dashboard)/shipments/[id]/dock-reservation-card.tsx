"use client";

import Link from "next/link";
import { Navigation, Warehouse } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import {
  dockReservationStatusBadgeVariant,
  dockReservationStatusLabels,
} from "@/lib/labels";
import {
  DockReservationDialog,
  type AssignableDock,
} from "@/app/(dashboard)/shipments/[id]/dock-reservation-dialog";
import type { DockReservationStatus, ShipmentStatus } from "@/generated/prisma/enums";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

/**
 * Role- and status-aware, same spirit as LoadReadyCard: renders nothing
 * once there's neither an existing reservation to show nor a reason to
 * offer creating one. A supplier only ever sees the read-only branch — it
 * never creates or manages a Warehouse/LoadingDock itself (see the schema
 * comment above Warehouse).
 */
export function DockReservationCard({
  status,
  companyType,
  reservation,
  shipmentId,
  assignableDocks,
  vehicle,
  driver,
}: {
  status: ShipmentStatus;
  companyType: "SUPPLIER" | "CUSTOMER";
  reservation: {
    warehouseId: string;
    warehouseName: string;
    warehouseAddress: string | null;
    warehouseMapsUrl: string | null;
    dockId: string;
    dockName: string;
    startAt: Date;
    status: DockReservationStatus;
  } | null;
  shipmentId: string;
  assignableDocks: AssignableDock[];
  vehicle: { plate: string; vehicleType: string } | null;
  driver: { fullName: string; phone: string | null } | null;
}) {
  // Same ASSIGNED-only window as markLoadReady/LoadReadyCard — the
  // reservation is for picking the cargo up, so it only makes sense before
  // the vehicle actually departs.
  const canCreate =
    companyType === "CUSTOMER" &&
    status === "ASSIGNED" &&
    !reservation &&
    vehicle != null &&
    driver != null;

  if (!reservation && !canCreate) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Warehouse className="text-muted-foreground size-4" />
          Depo Rampa Rezervasyonu
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {reservation ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Depo" value={reservation.warehouseName} />
              <Field label="Rampa" value={reservation.dockName} />
              <Field
                label="Planlanan Saat"
                value={formatDateTime(reservation.startAt)}
              />
              <Field
                label="Durum"
                value={
                  <Badge variant={dockReservationStatusBadgeVariant[reservation.status]}>
                    {dockReservationStatusLabels[reservation.status]}
                  </Badge>
                }
              />
              {reservation.warehouseAddress && (
                <div className="col-span-full">
                  <Field label="Adres" value={reservation.warehouseAddress} />
                </div>
              )}
            </div>
            {reservation.warehouseMapsUrl && (
              <a
                href={reservation.warehouseMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1 text-sm underline underline-offset-2"
              >
                <Navigation className="size-3.5" />
                Depoya Navigasyon
              </a>
            )}
            {companyType === "CUSTOMER" && (
              <Link
                href={`/warehouses/${reservation.warehouseId}/docks/${reservation.dockId}`}
                className="text-primary text-sm underline underline-offset-2"
              >
                Rampa Takvimine Git
              </Link>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Yükleme için henüz bir rampa rezervasyonu yapılmadı.
          </p>
        )}

        {canCreate &&
          (assignableDocks.length > 0 ? (
            <DockReservationDialog
              shipmentId={shipmentId}
              docks={assignableDocks}
              triggerLabel="Rampa Rezervasyonu Yap"
              plate={vehicle!.plate}
              driverName={driver!.fullName}
              driverPhone={driver!.phone}
              vehicleType={vehicle!.vehicleType}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              Rezervasyon yapabilmek için önce{" "}
              <Link href="/warehouses" className="text-primary underline underline-offset-2">
                Depo & Rampa
              </Link>{" "}
              sayfasından bir depo/rampa tanımlayın.
            </p>
          ))}
      </CardContent>
    </Card>
  );
}
