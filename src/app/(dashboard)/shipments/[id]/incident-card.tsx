"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import {
  resolveShipmentIncidentAsDispatcherAction,
  type ShipmentFormState,
} from "@/app/(dashboard)/shipments/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { confirmSubmit } from "@/lib/confirm-submit";

function ResolveIncidentDialog({ shipmentId }: { shipmentId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    ShipmentFormState,
    FormData
  >(
    resolveShipmentIncidentAsDispatcherAction.bind(null, shipmentId),
    undefined
  );

  // Same render-time close-on-success pattern as LoadReadyDialog.
  const [wasPending, setWasPending] = useState(isPending);
  if (wasPending !== isPending) {
    setWasPending(isPending);
    if (wasPending && open && !state?.error) {
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Sorunu Gider
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arızayı Gider</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={confirmSubmit(
            "Arızayı giderildi olarak işaretlemek istediğinize emin misiniz?"
          )}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`resolution-note-${shipmentId}`}>
              Not (opsiyonel)
            </Label>
            <Textarea
              id={`resolution-note-${shipmentId}`}
              name="resolutionNote"
              placeholder="Örn. yerine yeni araç gönderildi"
              rows={3}
            />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Giderildi Olarak İşaretle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hidden entirely unless there's an open incident to show — matches
 * PriceApprovalCard/LoadReadyCard's "render nothing until relevant" shape.
 * The resolve action is SUPPLIER-only (dispatcher override), same
 * restriction as every other operational action in this app; the customer
 * always sees this read-only.
 */
export function IncidentCard({
  shipmentId,
  companyType,
  incident,
}: {
  shipmentId: string;
  companyType: "SUPPLIER" | "CUSTOMER";
  incident: {
    note: string | null;
    photoUrl: string | null;
    reportedAt: Date;
    reportedByDriver: { fullName: string } | null;
  } | null;
}) {
  if (!incident) return null;

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-4" />
          Arıza Bildirildi
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          {incident.reportedByDriver?.fullName ?? "Şoför"} tarafından{" "}
          {formatDateTime(incident.reportedAt)} tarihinde bildirildi.
        </p>
        {incident.note && <p className="text-sm">{incident.note}</p>}
        {incident.photoUrl && (
          <a
            href={`/api/uploads/${incident.photoUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary w-fit text-sm underline underline-offset-2"
          >
            Fotoğrafı Görüntüle
          </a>
        )}
        {companyType === "SUPPLIER" && (
          <ResolveIncidentDialog shipmentId={shipmentId} />
        )}
      </CardContent>
    </Card>
  );
}
