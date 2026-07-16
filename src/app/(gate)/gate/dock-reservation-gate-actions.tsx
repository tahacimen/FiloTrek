"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  markReservationCompletedAction,
  markReservationVehicleArrivedAction,
} from "@/app/(gate)/gate/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  dockReservationStatusBadgeVariant,
  dockReservationStatusLabels,
} from "@/lib/labels";
import { DockReservationStatus } from "@/generated/prisma/enums";

/**
 * Sits alongside the gate guard's own entry/exit log — cancellation isn't
 * offered here (an administrative scheduling decision, made by the
 * customer's own dashboard user instead; see dock-reservation-status.ts).
 */
export function DockReservationGateActions({
  reservationId,
  status,
  warehouseName,
  dockName,
}: {
  reservationId: string;
  status: DockReservationStatus;
  warehouseName: string;
  dockName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick(
    action: (reservationId: string) => Promise<{ error?: string } | undefined>,
    confirmMessage: string
  ) {
    if (!confirm(confirmMessage)) return;
    startTransition(async () => {
      const result = await action(reservationId);
      if (result?.error) toast.error(result.error);
    });
  }

  const canMarkArrived = status === DockReservationStatus.CREATED;
  const canComplete =
    status === DockReservationStatus.CREATED ||
    status === DockReservationStatus.VEHICLE_ARRIVED;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Rampa: {warehouseName} — {dockName}
        </span>
        <Badge variant={dockReservationStatusBadgeVariant[status]}>
          {dockReservationStatusLabels[status]}
        </Badge>
      </div>
      {(canMarkArrived || canComplete) && (
        <div className="flex flex-wrap gap-2">
          {canMarkArrived && (
            <Button
              size="sm"
              disabled={isPending}
              onClick={() =>
                handleClick(
                  markReservationVehicleArrivedAction,
                  "Aracın rampaya vardığını onaylıyor musunuz?"
                )
              }
            >
              {isPending && <Loader2 className="animate-spin" />}
              Araç Geldi
            </Button>
          )}
          {canComplete && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                handleClick(
                  markReservationCompletedAction,
                  "Rampa işlemini tamamlandı olarak işaretlemek istiyor musunuz?"
                )
              }
            >
              Tamamlandı
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
