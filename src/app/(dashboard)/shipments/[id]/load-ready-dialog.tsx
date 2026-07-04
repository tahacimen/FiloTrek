"use client";

import { useActionState, useState } from "react";
import { Loader2, PackageCheck } from "lucide-react";

import {
  markLoadReadyAction,
  type ShipmentFormState,
} from "@/app/(dashboard)/shipments/actions";
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
import { confirmSubmit } from "@/lib/confirm-submit";

export function LoadReadyDialog({
  shipmentId,
  route,
  triggerLabel,
  triggerVariant,
  pickupGateInfo,
  pickupMapsUrl,
}: {
  shipmentId: string;
  route: string;
  triggerLabel: string;
  triggerVariant?: "default" | "outline";
  pickupGateInfo?: string | null;
  pickupMapsUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    ShipmentFormState,
    FormData
  >(markLoadReadyAction.bind(null, shipmentId), undefined);

  // Close the dialog on a successful submission — same render-time pattern
  // as AssignDialog (see that file for why this isn't a useEffect).
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
        <Button variant={triggerVariant}>
          <PackageCheck />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yük Hazır Bildirimi</DialogTitle>
          <DialogDescription>{route}</DialogDescription>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={confirmSubmit(
            "Yük hazır bildirimini göndermek istediğinize emin misiniz?"
          )}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`gate-${shipmentId}`}>Kapı / Rampa Bilgisi</Label>
            <Input
              id={`gate-${shipmentId}`}
              name="pickupGateInfo"
              required
              placeholder="Örn: B Kapısı, 4 No'lu Rampa"
              defaultValue={pickupGateInfo ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`maps-${shipmentId}`}>
              Google Maps Konum Linki (opsiyonel)
            </Label>
            <Input
              id={`maps-${shipmentId}`}
              name="pickupMapsUrl"
              type="url"
              placeholder="https://maps.google.com/..."
              defaultValue={pickupMapsUrl ?? ""}
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
              Bildirimi Gönder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
