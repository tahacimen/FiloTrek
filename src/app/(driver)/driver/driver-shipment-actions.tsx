"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import {
  advanceShipmentStatusAsDriverAction,
  type DriverShipmentFormState,
} from "@/app/(driver)/driver/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmSubmit } from "@/lib/confirm-submit";
import { ShipmentStatus } from "@/generated/prisma/enums";

export function DriverShipmentActions({
  shipmentId,
  targetStatus,
  label,
}: {
  shipmentId: string;
  targetStatus: ShipmentStatus;
  label: string;
}) {
  const [state, formAction, isPending] = useActionState<
    DriverShipmentFormState,
    FormData
  >(
    advanceShipmentStatusAsDriverAction.bind(null, shipmentId, targetStatus),
    undefined
  );

  // Mandatory only for leaving the pickup point after loading — the server
  // (advanceShipmentStatusAsDriver) independently enforces this too, this
  // `required` is just so a well-behaved browser catches it before a round
  // trip, not the actual guarantee.
  const isDeparture = targetStatus === ShipmentStatus.EN_ROUTE;

  return (
    <form
      action={formAction}
      onSubmit={confirmSubmit(`"${label}" bildirmek istediğinize emin misiniz?`)}
      className="flex flex-col gap-2"
    >
      {isDeparture && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`photo-${shipmentId}`}>
            Yükleme Fotoğrafı (zorunlu)
          </Label>
          <Input
            id={`photo-${shipmentId}`}
            name="photo"
            type="file"
            accept="image/*"
            capture="environment"
            required
          />
        </div>
      )}
      <Textarea
        name="note"
        placeholder="Not ekle (opsiyonel) — örn. kapıda bekleme süresi"
        rows={2}
      />
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending && <Loader2 className="animate-spin" />}
        {label}
      </Button>
    </form>
  );
}
