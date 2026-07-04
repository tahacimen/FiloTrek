"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  proposePriceAction,
  rejectPriceAction,
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

/**
 * Backs two distinct buttons that are really the same form underneath: a
 * bare "Reddet" is rejectPriceAction with no amount, and "Yeni Fiyat Öner"
 * is proposePriceAction — the only real differences are which action gets
 * called, whether the amount is required, and the copy.
 */
export function PriceOfferDialog({
  shipmentId,
  mode,
  triggerLabel,
  triggerVariant,
}: {
  shipmentId: string;
  mode: "reject" | "propose";
  triggerLabel: string;
  triggerVariant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const action =
    mode === "propose"
      ? proposePriceAction.bind(null, shipmentId)
      : rejectPriceAction.bind(null, shipmentId);
  const [state, formAction, isPending] = useActionState<
    ShipmentFormState,
    FormData
  >(action, undefined);

  const [wasPending, setWasPending] = useState(isPending);
  if (wasPending !== isPending) {
    setWasPending(isPending);
    if (wasPending && open && !state?.error) {
      setOpen(false);
    }
  }

  const amountFieldName = mode === "propose" ? "amount" : "counterAmount";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "propose" ? "Yeni Fiyat Öner" : "Fiyatı Reddet"}
          </DialogTitle>
          {mode === "reject" && (
            <DialogDescription>
              İsterseniz önerdiğiniz bir fiyatla birlikte reddedebilir, ya da
              alanı boş bırakarak sadece reddedebilirsiniz.
            </DialogDescription>
          )}
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={confirmSubmit(
            mode === "propose"
              ? "Bu fiyatı önermek istediğinize emin misiniz?"
              : "Fiyatı reddetmek istediğinize emin misiniz?"
          )}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${amountFieldName}-${shipmentId}`}>
              {mode === "propose" ? "Fiyat (₺)" : "Önerdiğiniz Fiyat (₺, opsiyonel)"}
            </Label>
            <Input
              id={`${amountFieldName}-${shipmentId}`}
              name={amountFieldName}
              type="number"
              min="0"
              step="0.01"
              required={mode === "propose"}
            />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="submit"
              variant={mode === "reject" ? "destructive" : "default"}
              disabled={isPending}
            >
              {isPending && <Loader2 className="animate-spin" />}
              {mode === "propose" ? "Teklifi Gönder" : "Reddi Gönder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
