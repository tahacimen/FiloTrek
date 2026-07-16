"use client";

import { useActionState, useMemo, useState } from "react";
import { Loader2, Warehouse as WarehouseIcon } from "lucide-react";

import {
  createDockReservationForShipmentAction,
  type ShipmentFormState,
} from "@/app/(dashboard)/shipments/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { confirmSubmit } from "@/lib/confirm-submit";
import {
  listOpenSlotsForDate,
  toWeekParam,
  type DockWorkingHourRow,
} from "@/lib/dock-calendar";

export type AssignableDock = {
  id: string;
  name: string;
  warehouseId: string;
  warehouseName: string;
  slotDurationMinutes: number;
  workingHours: DockWorkingHourRow[];
};

/** No live-availability check against other reservations here — same tradeoff as the calendar's own click-to-book flow; the DB exclusion constraint is the real guarantee (see dock-reservation-service.ts). */
export function DockReservationDialog({
  shipmentId,
  docks,
  triggerLabel,
  plate,
  driverName,
  driverPhone,
  vehicleType,
}: {
  shipmentId: string;
  docks: AssignableDock[];
  triggerLabel: string;
  plate: string;
  driverName: string;
  driverPhone: string | null;
  vehicleType: string;
}) {
  const [open, setOpen] = useState(false);
  const [dockId, setDockId] = useState(docks[0]?.id ?? "");
  const [date, setDate] = useState(() => toWeekParam(new Date()));
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("Sefer için yükleme");

  const action = createDockReservationForShipmentAction.bind(
    null,
    shipmentId,
    dockId
  );
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

  const dock = docks.find((d) => d.id === dockId);

  const openTimes = useMemo(() => {
    if (!dock || !date) return [];
    const [y, m, d] = date.split("-").map(Number);
    return listOpenSlotsForDate(
      new Date(y, m - 1, d),
      dock.workingHours,
      dock.slotDurationMinutes
    );
  }, [dock, date]);

  const startAt = useMemo(() => {
    if (!date || !time) return null;
    const [y, m, d] = date.split("-").map(Number);
    const [h, min] = time.split(":").map(Number);
    return new Date(y, m - 1, d, h, min);
  }, [date, time]);

  const payload = JSON.stringify({
    reservationType: "LOADING",
    startAt: startAt ? startAt.toISOString() : "",
    reason,
    plate,
    driverName,
    driverPhone,
    vehicleType,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <WarehouseIcon />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rampa Rezervasyonu Yap</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={confirmSubmit(
            "Bu rampa rezervasyonunu oluşturmak istediğinize emin misiniz?"
          )}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="payload" value={payload} readOnly />

          <div className="flex flex-col gap-2">
            <Label>Rampa</Label>
            <Select
              value={dockId}
              onValueChange={(value) => {
                setDockId(value);
                setTime("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {docks.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.warehouseName} — {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reservationDate">Tarih</Label>
              <Input
                id="reservationDate"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime("");
                }}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Saat</Label>
              <Select
                value={time}
                onValueChange={setTime}
                disabled={openTimes.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      openTimes.length === 0
                        ? "Bu tarihte müsait saat yok"
                        : "Seçin"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {openTimes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reservationReason">Gerekçe</Label>
            <Input
              id="reservationReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending || !startAt}>
              {isPending && <Loader2 className="animate-spin" />}
              Rezervasyon Oluştur
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
