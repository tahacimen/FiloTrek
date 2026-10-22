"use client";

import { useActionState } from "react";
import { Clock, Loader2 } from "lucide-react";

import {
  setLatestLoadingAction,
  type ShipmentFormState,
} from "@/app/(dashboard)/shipments/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ShipmentStatus } from "@/generated/prisma/enums";

/** Date | null → the "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
function toLocalInput(value: Date | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/**
 * N4: view/edit the "en geç yükleme saati". Editable by either party until the
 * shipment is completed/cancelled; the server enforces the same window.
 */
export function LatestLoadingCard({
  shipmentId,
  status,
  latestLoadingAt,
}: {
  shipmentId: string;
  status: ShipmentStatus;
  latestLoadingAt: Date | null;
}) {
  const [state, formAction, isPending] = useActionState<
    ShipmentFormState,
    FormData
  >(setLatestLoadingAction.bind(null, shipmentId), undefined);

  const editable = status !== "COMPLETED" && status !== "CANCELLED";

  if (!editable && !latestLoadingAt) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="text-muted-foreground size-4" />
          En Geç Yükleme Saati
        </CardTitle>
      </CardHeader>
      <CardContent>
        {editable ? (
          <form action={formAction} className="flex flex-wrap items-end gap-3">
            <Input
              name="latestLoadingAt"
              type="datetime-local"
              defaultValue={toLocalInput(latestLoadingAt)}
              className="w-auto"
            />
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Kaydet
            </Button>
            {state?.error && (
              <p className="w-full text-sm text-destructive" role="alert">
                {state.error}
              </p>
            )}
          </form>
        ) : (
          <p className="text-sm font-medium">
            {latestLoadingAt
              ? new Intl.DateTimeFormat("tr-TR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(latestLoadingAt))
              : "—"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
