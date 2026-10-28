"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Undo2 } from "lucide-react";

import {
  advanceShipmentStatusAction,
  cancelShipmentAction,
  revertShipmentStatusAction,
} from "@/app/(dashboard)/shipments/actions";
import { Button } from "@/components/ui/button";
import { shipmentStatusLabels } from "@/lib/labels";
import {
  canCancelShipment,
  canRevertShipment,
  getNextShipmentSteps,
  previousShipmentStatus,
} from "@/core/shipment/shipment-transitions";
import { ShipmentStatus } from "@/generated/prisma/enums";

export function ShipmentStatusActions({
  shipmentId,
  status,
}: {
  shipmentId: string;
  status: ShipmentStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const canCancel = canCancelShipment(status);
  const canRevert = canRevertShipment(status);
  const previous = previousShipmentStatus(status);

  // PENDING -> ASSIGNED needs a vehicle + driver pick, which only the
  // Atama screen collects — the generic advance action rejects it
  // server-side (see shipment-status.ts), so it's never offered here either.
  const isAwaitingAssignment = status === ShipmentStatus.PENDING;
  const nextSteps = getNextShipmentSteps(status).filter(
    (step) => step !== ShipmentStatus.ASSIGNED
  );

  if (
    !isAwaitingAssignment &&
    nextSteps.length === 0 &&
    !canCancel &&
    !canRevert
  ) {
    return null;
  }

  function handleAdvance(targetStatus: ShipmentStatus) {
    if (
      !confirm(
        `"${shipmentStatusLabels[targetStatus]}" durumuna geçirmek istediğinize emin misiniz?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await advanceShipmentStatusAction(shipmentId, targetStatus);
      if (result?.error) toast.error(result.error);
    });
  }

  function handleCancel() {
    if (!confirm("Bu seferi iptal etmek istediğinize emin misiniz?")) return;
    startTransition(async () => {
      const result = await cancelShipmentAction(shipmentId);
      if (result?.error) toast.error(result.error);
    });
  }

  function handleRevert() {
    if (!previous) return;
    if (
      !confirm(
        `Durumu bir önceki adıma ("${shipmentStatusLabels[previous]}") geri almak istediğinize emin misiniz?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await revertShipmentStatusAction(shipmentId);
      if (result?.error) toast.error(result.error);
      else toast.success("Durum geri alındı.");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isAwaitingAssignment && (
        <Button asChild>
          <Link href="/assign">
            <ClipboardList />
            Atama Ekranına Git
          </Link>
        </Button>
      )}
      {nextSteps.map((step) => (
        <Button key={step} onClick={() => handleAdvance(step)} disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          {shipmentStatusLabels[step]}
        </Button>
      ))}
      {canRevert && previous && (
        <Button variant="outline" onClick={handleRevert} disabled={isPending}>
          <Undo2 />
          Durumu Geri Al
        </Button>
      )}
      {canCancel && (
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={handleCancel}
          disabled={isPending}
        >
          Seferi İptal Et
        </Button>
      )}
    </div>
  );
}
