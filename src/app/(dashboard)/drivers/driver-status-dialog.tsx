"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  setDriverLeaveAction,
  setDriverStatusAction,
  type DriverFormState,
} from "@/app/(dashboard)/drivers/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DriverStatus } from "@/generated/prisma/enums";
import {
  effectiveDriverStatus,
  effectiveDriverStatusLabels,
} from "@/lib/driver-status";
import type { SerializableDriver } from "@/app/(dashboard)/drivers/types";

/** Date | string | null → the yyyy-MM-dd a <input type="date"> expects. */
function toDateInput(value: Date | string | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function DriverStatusDialog({ driver }: { driver: SerializableDriver }) {
  const [open, setOpen] = useState(false);
  const [isStatusPending, startStatusTransition] = useTransition();
  const [leaveState, leaveAction, isLeavePending] = useActionState<
    DriverFormState,
    FormData
  >(setDriverLeaveAction.bind(null, driver.id), undefined);

  const effective = effectiveDriverStatus(driver);
  const onTrip = driver.status === DriverStatus.ON_TRIP;

  function handleSetStatus(status: DriverStatus) {
    startStatusTransition(async () => {
      const result = await setDriverStatusAction(driver.id, status);
      if (result?.error) toast.error(result.error);
      else toast.success("Durum güncellendi.");
    });
  }

  function clearLeave() {
    const fd = new FormData();
    fd.set("leaveStartDate", "");
    fd.set("leaveEndDate", "");
    startStatusTransition(async () => {
      const result = await setDriverLeaveAction(driver.id, undefined, fd);
      if (result?.error) toast.error(result.error);
      else toast.success("İzin kaldırıldı.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Durum & İzin">
          <span className="sr-only">Durum & İzin Yönet</span>
          <CalendarClock />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Durum & İzin — {driver.fullName}</DialogTitle>
          <DialogDescription>
            Mevcut durum:{" "}
            <span className="font-medium">
              {effectiveDriverStatusLabels[effective]}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Çalışma Durumu</Label>
            {onTrip ? (
              <p className="text-muted-foreground text-sm">
                Şoför seferde. Sefer tamamlanınca durum otomatik güncellenir.
              </p>
            ) : (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={
                    driver.status === DriverStatus.AVAILABLE
                      ? "default"
                      : "outline"
                  }
                  disabled={isStatusPending}
                  onClick={() => handleSetStatus(DriverStatus.AVAILABLE)}
                >
                  Müsait
                </Button>
                <Button
                  type="button"
                  variant={
                    driver.status === DriverStatus.OFF_DUTY
                      ? "default"
                      : "outline"
                  }
                  disabled={isStatusPending}
                  onClick={() => handleSetStatus(DriverStatus.OFF_DUTY)}
                >
                  Görevde Değil
                </Button>
              </div>
            )}
          </div>

          <Separator />

          <form action={leaveAction} className="flex flex-col gap-3">
            <Label>İzin Tarih Aralığı</Label>
            <p className="text-muted-foreground text-xs">
              Bu aralıkta şoför otomatik olarak &quot;İzinli&quot; görünür ve
              yeni sefere atanamaz. Aralık bitince otomatik düzelir.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="leaveStartDate" className="text-xs">
                  Başlangıç
                </Label>
                <Input
                  id="leaveStartDate"
                  name="leaveStartDate"
                  type="date"
                  defaultValue={toDateInput(driver.leaveStartDate)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="leaveEndDate" className="text-xs">
                  Bitiş
                </Label>
                <Input
                  id="leaveEndDate"
                  name="leaveEndDate"
                  type="date"
                  defaultValue={toDateInput(driver.leaveEndDate)}
                />
              </div>
            </div>
            {leaveState?.error && (
              <p className="text-sm text-destructive" role="alert">
                {leaveState.error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={isLeavePending}>
                {isLeavePending && <Loader2 className="animate-spin" />}
                İzni Kaydet
              </Button>
              {(driver.leaveStartDate || driver.leaveEndDate) && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isStatusPending}
                  onClick={clearLeave}
                >
                  İzni Kaldır
                </Button>
              )}
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
