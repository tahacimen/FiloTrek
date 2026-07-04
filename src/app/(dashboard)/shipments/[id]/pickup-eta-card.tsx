"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import {
  setPickupEtaAction,
  type ShipmentFormState,
} from "@/app/(dashboard)/shipments/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { confirmSubmit } from "@/lib/confirm-submit";
import type { ShipmentStatus } from "@/generated/prisma/enums";

/** <input type="datetime-local"> expects "YYYY-MM-DDTHH:mm" with no timezone offset. */
function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Separate component (rather than an inline conditional block in
 * PickupEtaCard) so useActionState is only ever mounted while editing is
 * actually possible — mirrors LoadReadyDialog's split from LoadReadyCard,
 * which exists for the same reason: canSubmit can flip false on a
 * re-render (a status transition) without unmounting the parent card, and
 * a hook can't be called conditionally within one mounted instance.
 */
function PickupEtaForm({
  shipmentId,
  estimatedPickupArrivalAt,
}: {
  shipmentId: string;
  estimatedPickupArrivalAt: Date | null;
}) {
  const [state, formAction, isPending] = useActionState<
    ShipmentFormState,
    FormData
  >(setPickupEtaAction.bind(null, shipmentId), undefined);

  return (
    <form
      action={formAction}
      onSubmit={confirmSubmit(
        "Tahmini varış saatini kaydetmek istediğinize emin misiniz?"
      )}
      className="flex flex-col gap-2"
    >
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor={`eta-${shipmentId}`}>
            {estimatedPickupArrivalAt
              ? "Tahmini varışı güncelle"
              : "Tahmini varış tarihi ve saati"}
          </Label>
          <Input
            id={`eta-${shipmentId}`}
            name="estimatedPickupArrivalAt"
            type="datetime-local"
            required
            defaultValue={
              estimatedPickupArrivalAt
                ? toDateTimeLocalValue(estimatedPickupArrivalAt)
                : undefined
            }
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          Kaydet
        </Button>
      </div>
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function PickupEtaCard({
  shipmentId,
  status,
  companyType,
  estimatedPickupArrivalAt,
}: {
  shipmentId: string;
  status: ShipmentStatus;
  companyType: "SUPPLIER" | "CUSTOMER";
  estimatedPickupArrivalAt: Date | null;
}) {
  const canSubmit =
    companyType === "SUPPLIER" &&
    (status === "ASSIGNED" || status === "HEADING_TO_PICKUP");

  if (!estimatedPickupArrivalAt && !canSubmit) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yükleme Noktasına Tahmini Varış</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {estimatedPickupArrivalAt && (
          <p className="text-sm font-medium">
            {formatDateTime(estimatedPickupArrivalAt)}
          </p>
        )}
        {canSubmit && (
          <PickupEtaForm
            shipmentId={shipmentId}
            estimatedPickupArrivalAt={estimatedPickupArrivalAt}
          />
        )}
      </CardContent>
    </Card>
  );
}
