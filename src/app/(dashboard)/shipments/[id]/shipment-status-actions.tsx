"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  advanceShipmentStatusAction,
  cancelShipmentAction,
} from "@/app/(dashboard)/shipments/actions";
import { Button } from "@/components/ui/button";
import { shipmentStatusLabels } from "@/lib/labels";
import {
  canCancelShipment,
  getNextShipmentSteps,
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

  // PENDING -> ASSIGNED needs a vehicle + driver pick, which only the
  // Atama screen collects — the generic advance action rejects it
  // server-side (see shipment-status.ts), so it's never offered here either.
  const isAwaitingAssignment = status === ShipmentStatus.PENDING;
  const nextSteps = getNextShipmentSteps(status).filter(
    (step) => step !== ShipmentStatus.ASSIGNED
  );

  if (!isAwaitingAssignment && nextSteps.length === 0 && !canCancel) {
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
