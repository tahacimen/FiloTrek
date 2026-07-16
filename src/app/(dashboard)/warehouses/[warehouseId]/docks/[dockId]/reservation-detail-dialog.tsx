"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  cancelReservationAction,
  markCompletedAction,
  markVehicleArrivedAction,
} from "@/app/(dashboard)/warehouses/[warehouseId]/docks/[dockId]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import {
  dockReservationStatusBadgeVariant,
  dockReservationStatusLabels,
  dockReservationTypeLabels,
  vehicleTypeLabels,
} from "@/lib/labels";
import { DockReservationStatus } from "@/generated/prisma/enums";
import type { SerializableReservation } from "@/app/(dashboard)/warehouses/[warehouseId]/docks/[dockId]/types";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export function ReservationDetailDialog({
  warehouseId,
  dockId,
  reservation,
  onClose,
}: {
  warehouseId: string;
  dockId: string;
  reservation: SerializableReservation;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function run(
    action: (
      warehouseId: string,
      dockId: string,
      reservationId: string
    ) => Promise<{ error?: string } | undefined>,
    confirmMessage: string
  ) {
    if (!confirm(confirmMessage)) return;
    startTransition(async () => {
      const result = await action(warehouseId, dockId, reservation.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      onClose();
    });
  }

  const canMarkArrived = reservation.status === DockReservationStatus.CREATED;
  const canComplete =
    reservation.status === DockReservationStatus.CREATED ||
    reservation.status === DockReservationStatus.VEHICLE_ARRIVED;
  const canCancel = canComplete;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {reservation.plate}
            <Badge variant={dockReservationStatusBadgeVariant[reservation.status]}>
              {dockReservationStatusLabels[reservation.status]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Tür"
            value={dockReservationTypeLabels[reservation.reservationType]}
          />
          <Field label="Başlangıç" value={formatDateTime(reservation.startAt)} />
          <Field label="Gerekçe" value={reservation.reason} />
          <Field
            label="Araç Türü"
            value={
              reservation.vehicleType ? vehicleTypeLabels[reservation.vehicleType] : "Belirtilmedi"
            }
          />
          <Field label="Yük Tipi" value={reservation.cargoType ?? "Belirtilmedi"} />
          <Field label="Adet" value={reservation.quantity ?? "Belirtilmedi"} />
          <Field
            label="Toplam Ağırlık"
            value={
              reservation.totalWeightKg != null ? `${reservation.totalWeightKg} kg` : "Belirtilmedi"
            }
          />
          <Field label="Sürücü Adı" value={reservation.driverName} />
          <Field label="Sürücü Telefon" value={reservation.driverPhone ?? "Belirtilmedi"} />
          {reservation.notes && (
            <div className="col-span-full">
              <Field label="Ek Notlar" value={reservation.notes} />
            </div>
          )}
        </div>

        {(canMarkArrived || canComplete || canCancel) && (
          <DialogFooter className="flex-wrap gap-2 sm:justify-start">
            {canMarkArrived && (
              <Button
                disabled={isPending}
                onClick={() =>
                  run(markVehicleArrivedAction, "Aracın vardığını onaylıyor musunuz?")
                }
              >
                {isPending && <Loader2 className="animate-spin" />}
                Araç Geldi
              </Button>
            )}
            {canComplete && (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  run(markCompletedAction, "Rezervasyonu tamamlandı olarak işaretlemek istiyor musunuz?")
                }
              >
                Tamamlandı
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={isPending}
                onClick={() =>
                  run(cancelReservationAction, "Bu rezervasyonu iptal etmek istediğinize emin misiniz?")
                }
              >
                İptal Et
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
