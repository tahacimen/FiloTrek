"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, UserRoundX } from "lucide-react";
import { toast } from "sonner";

import {
  deactivateDriverAction,
  reactivateDriverAction,
  type DriverFormState,
} from "@/app/(dashboard)/drivers/actions";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DriverDeactivationReason } from "@/generated/prisma/enums";
import { driverDeactivationReasonLabels } from "@/lib/labels";
import type { SerializableDriver } from "@/app/(dashboard)/drivers/types";

export function DriverDeactivateDialog({
  driver,
}: {
  driver: SerializableDriver;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(DriverDeactivationReason.LEFT_JOB);
  const [isReactivating, startReactivate] = useTransition();
  const [state, formAction, isPending] = useActionState<
    DriverFormState,
    FormData
  >(deactivateDriverAction.bind(null, driver.id), undefined);

  const [wasPending, setWasPending] = useState(isPending);
  if (wasPending !== isPending) {
    setWasPending(isPending);
    if (wasPending && open && !state?.error) setOpen(false);
  }

  function handleReactivate() {
    startReactivate(async () => {
      const result = await reactivateDriverAction(driver.id);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(`${driver.fullName} yeniden etkinleştirildi.`);
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={driver.isActive ? "Devre Dışı Bırak" : "Yeniden Etkinleştir"}
        >
          <span className="sr-only">
            {driver.isActive ? "Devre Dışı Bırak" : "Yeniden Etkinleştir"}
          </span>
          <UserRoundX className={driver.isActive ? "" : "text-destructive"} />
        </Button>
      </DialogTrigger>
      <DialogContent>
        {driver.isActive ? (
          <>
            <DialogHeader>
              <DialogTitle>Şoförü Devre Dışı Bırak</DialogTitle>
              <DialogDescription>
                {driver.fullName} kalıcı olarak devre dışı bırakılacak ve hiçbir
                sefere atanamayacak. Dilediğiniz zaman yeniden
                etkinleştirebilirsiniz.
              </DialogDescription>
            </DialogHeader>
            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="reason">Neden</Label>
                <input type="hidden" name="reason" value={reason} />
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger id="reason" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(DriverDeactivationReason).map((r) => (
                      <SelectItem key={r} value={r}>
                        {driverDeactivationReasonLabels[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="note">
                  Açıklama
                  {reason === DriverDeactivationReason.OTHER
                    ? " (zorunlu)"
                    : " (opsiyonel)"}
                </Label>
                <Textarea id="note" name="note" rows={3} />
              </div>
              {state?.error && (
                <p className="text-sm text-destructive" role="alert">
                  {state.error}
                </p>
              )}
              <DialogFooter>
                <Button type="submit" variant="destructive" disabled={isPending}>
                  {isPending && <Loader2 className="animate-spin" />}
                  Devre Dışı Bırak
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Şoförü Yeniden Etkinleştir</DialogTitle>
              <DialogDescription>
                {driver.fullName} şu anda devre dışı
                {driver.deactivationReason
                  ? ` (${driverDeactivationReasonLabels[driver.deactivationReason]})`
                  : ""}
                .
                {driver.deactivationNote ? ` Not: ${driver.deactivationNote}` : ""}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                onClick={handleReactivate}
                disabled={isReactivating}
              >
                {isReactivating && <Loader2 className="animate-spin" />}
                Yeniden Etkinleştir
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
