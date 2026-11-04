"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Check, Loader2, Navigation, Send, Warehouse, X } from "lucide-react";
import { toast } from "sonner";

import {
  approveDriverReservationAction,
  enableDriverDockSelectionAction,
  rejectDriverReservationAction,
  withdrawDriverDockSelectionAction,
} from "@/app/(dashboard)/shipments/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  driverSelectionEnabled,
  vehicle,
  driver,
}: {
  status: ShipmentStatus;
  companyType: "SUPPLIER" | "CUSTOMER";
  reservation: {
    id: string;
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
  driverSelectionEnabled: boolean;
  vehicle: { plate: string; vehicleType: string } | null;
  driver: { fullName: string; phone: string | null } | null;
}) {
  const [isPending, startTransition] = useTransition();
  const isCustomer = companyType === "CUSTOMER";

  // Same ASSIGNED-only window as markLoadReady/LoadReadyCard — the
  // reservation is for picking the cargo up, so it only makes sense before
  // the vehicle actually departs.
  const canCreate =
    isCustomer &&
    status === "ASSIGNED" &&
    !reservation &&
    vehicle != null &&
    driver != null;

  // D5: a driver-requested slot the customer must approve/reject.
  const isPendingRequest = reservation?.status === "REQUESTED";
  // Customer opened the calendar but the driver hasn't picked yet.
  const awaitingDriverPick = isCustomer && driverSelectionEnabled && !reservation;

  if (!reservation && !canCreate && !awaitingDriverPick) return null;

  function runAction(fn: () => Promise<{ error?: string } | undefined>, ok: string) {
    startTransition(async () => {
      const result = await fn();
      if (result?.error) toast.error(result.error);
      else toast.success(ok);
    });
  }

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
            {isCustomer && (
              <Link
                href={`/warehouses/${reservation.warehouseId}/docks/${reservation.dockId}`}
                className="text-primary text-sm underline underline-offset-2"
              >
                Rampa Takvimine Git
              </Link>
            )}
            {isCustomer && isPendingRequest && (
              <div className="flex flex-col gap-2 border-t pt-3">
                <p className="text-muted-foreground text-sm">
                  Şoför bu rampa ve saati seçti. Onaylarsanız rezervasyon
                  kesinleşir.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      runAction(
                        () =>
                          approveDriverReservationAction(
                            shipmentId,
                            reservation.id
                          ),
                        "Rezervasyon onaylandı."
                      )
                    }
                  >
                    {isPending ? <Loader2 className="animate-spin" /> : <Check />}
                    Onayla
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={isPending}
                    onClick={() =>
                      runAction(
                        () =>
                          rejectDriverReservationAction(
                            shipmentId,
                            reservation.id
                          ),
                        "Talep reddedildi."
                      )
                    }
                  >
                    <X />
                    Reddet
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : awaitingDriverPick ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              Takvim şoföre gönderildi — şoförün rampa ve saat seçmesi
              bekleniyor.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                runAction(
                  () => withdrawDriverDockSelectionAction(shipmentId),
                  "Takvim geri alındı."
                )
              }
              className="w-fit"
            >
              {isPending && <Loader2 className="animate-spin" />}
              Vazgeç
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Yükleme için henüz bir rampa rezervasyonu yapılmadı.
          </p>
        )}

        {canCreate &&
          (assignableDocks.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <DockReservationDialog
                shipmentId={shipmentId}
                docks={assignableDocks}
                triggerLabel="Rampa Rezervasyonu Yap"
                plate={vehicle!.plate}
                driverName={driver!.fullName}
                driverPhone={driver!.phone}
                vehicleType={vehicle!.vehicleType}
              />
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  runAction(
                    () => enableDriverDockSelectionAction(shipmentId),
                    "Takvim şoföre gönderildi."
                  )
                }
              >
                {isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Takvimi Şoföre Gönder
              </Button>
            </div>
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
