"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import {
  reportShipmentIncidentAction,
  resolveShipmentIncidentAsDriverAction,
  type DriverShipmentFormState,
} from "@/app/(driver)/driver/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmSubmit } from "@/lib/confirm-submit";

/** Closes the dialog on a successful submission — same render-time pattern as LoadReadyDialog. */
function useCloseOnSuccess(
  isPending: boolean,
  open: boolean,
  setOpen: (open: boolean) => void,
  hasError: boolean
) {
  const [wasPending, setWasPending] = useState(isPending);
  if (wasPending !== isPending) {
    setWasPending(isPending);
    if (wasPending && open && !hasError) {
      setOpen(false);
    }
  }
}

function ReportIncidentDialog({
  shipmentId,
  route,
}: {
  shipmentId: string;
  route: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    DriverShipmentFormState,
    FormData
  >(reportShipmentIncidentAction.bind(null, shipmentId), undefined);
  useCloseOnSuccess(isPending, open, setOpen, !!state?.error);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive">
          <AlertTriangle />
          Arıza Bildir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arıza Bildir</DialogTitle>
          <DialogDescription>{route}</DialogDescription>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={confirmSubmit("Arıza bildirmek istediğinize emin misiniz?")}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`incident-note-${shipmentId}`}>
              Not (opsiyonel)
            </Label>
            <Textarea
              id={`incident-note-${shipmentId}`}
              name="note"
              placeholder="Ne oldu?"
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`incident-photo-${shipmentId}`}>
              Fotoğraf (opsiyonel)
            </Label>
            <Input
              id={`incident-photo-${shipmentId}`}
              name="photo"
              type="file"
              accept="image/*"
              capture="environment"
            />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Arızayı Bildir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResolveIncidentDialog({ shipmentId }: { shipmentId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    DriverShipmentFormState,
    FormData
  >(resolveShipmentIncidentAsDriverAction.bind(null, shipmentId), undefined);
  useCloseOnSuccess(isPending, open, setOpen, !!state?.error);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <CheckCircle2 />
          Arıza Giderildi
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arıza Giderildi</DialogTitle>
          <DialogDescription>
            Sorun çözüldüğünde seferinize devam edebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={confirmSubmit(
            "Arızanın giderildiğini bildirmek istediğinize emin misiniz?"
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
              placeholder="Örn. lastik değiştirildi"
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
              Devam Ediyorum
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Rendered alongside (not instead of) the shipment's normal next-step
 * action — a breakdown can happen at any point during an active shipment,
 * independent of what status step the driver is about to report next.
 */
export function DriverIncidentActions({
  shipmentId,
  hasOpenIncident,
  route,
}: {
  shipmentId: string;
  hasOpenIncident: boolean;
  route: string;
}) {
  return hasOpenIncident ? (
    <ResolveIncidentDialog shipmentId={shipmentId} />
  ) : (
    <ReportIncidentDialog shipmentId={shipmentId} route={route} />
  );
}
