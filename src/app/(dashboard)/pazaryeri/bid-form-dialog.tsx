"use client";

import { useActionState, useState } from "react";
import { HandCoins, Loader2 } from "lucide-react";

import {
  submitBidAction,
  type MarketplaceFormState,
} from "@/app/(dashboard)/pazaryeri/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmSubmit } from "@/lib/confirm-submit";

export function BidFormDialog({
  shipmentId,
  existingBid,
}: {
  shipmentId: string;
  existingBid?: {
    price: number;
    message: string | null;
    transitDays: number | null;
    validUntil: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const action = submitBidAction.bind(null, shipmentId);
  const [state, formAction, isPending] = useActionState<
    MarketplaceFormState,
    FormData
  >(action, undefined);

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
        <Button size="sm" variant={existingBid ? "outline" : "default"}>
          <HandCoins />
          {existingBid ? "Teklifi Güncelle" : "Teklif Ver"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existingBid ? "Teklifi Güncelle" : "Teklif Ver"}</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={confirmSubmit("Bu teklifi göndermek istediğinize emin misiniz?")}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="price">Teklif Fiyatı (₺)</Label>
            <Input
              id="price"
              name="price"
              type="number"
              step="1"
              min="0"
              required
              defaultValue={existingBid?.price}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="transitDays">Transit Süresi (gün)</Label>
              <Input
                id="transitDays"
                name="transitDays"
                type="number"
                step="1"
                min="1"
                defaultValue={existingBid?.transitDays ?? ""}
                placeholder="örn. 3"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="validUntil">Teklif Geçerlilik Tarihi</Label>
              <Input
                id="validUntil"
                name="validUntil"
                type="date"
                defaultValue={existingBid?.validUntil ?? ""}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="message">Mesaj (opsiyonel)</Label>
            <Textarea
              id="message"
              name="message"
              rows={3}
              defaultValue={existingBid?.message ?? ""}
              placeholder="Örn. müsait araç bilgisi, ek koşullar"
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
              Gönder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
