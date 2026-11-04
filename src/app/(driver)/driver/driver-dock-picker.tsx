"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarClock, Loader2, Warehouse } from "lucide-react";
import { toast } from "sonner";

import { requestDockReservationAction } from "@/app/(driver)/driver/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listOpenSlotsForDate,
  type DockWorkingHourRow,
} from "@/lib/dock-calendar";

export type DriverDockOption = {
  id: string;
  name: string;
  warehouseId: string;
  warehouseName: string;
  slotDurationMinutes: number;
  workingHours: DockWorkingHourRow[];
};

function todayStr(): string {
  const d = new Date();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * D5: the driver self-picks a loading dock + open slot for a shipment whose
 * customer opened the calendar to them. The chosen slot becomes a REQUESTED
 * reservation the customer then approves. Open-slot math is the same
 * client/server-shared `listOpenSlotsForDate` the customer's own booking
 * dialog uses; the server re-validates the final choice.
 */
export function DriverDockPicker({
  shipmentId,
  docks,
}: {
  shipmentId: string;
  docks: DriverDockOption[];
}) {
  const [dockId, setDockId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedDock = docks.find((d) => d.id === dockId) ?? null;

  const slots = useMemo(() => {
    if (!selectedDock || !date) return [];
    // Parse "YYYY-MM-DD" as a local date (same convention as the slot submit).
    const [y, m, d] = date.split("-").map(Number);
    const localDate = new Date(y, m - 1, d);
    return listOpenSlotsForDate(
      localDate,
      selectedDock.workingHours,
      selectedDock.slotDurationMinutes
    );
  }, [selectedDock, date]);

  function handleSubmit() {
    if (!dockId || !date || !slot) {
      toast.error("Depo/rampa, tarih ve saat seçin.");
      return;
    }
    const startAt = new Date(`${date}T${slot}:00`);
    if (Number.isNaN(startAt.getTime())) {
      toast.error("Geçerli bir saat seçin.");
      return;
    }
    startTransition(async () => {
      const result = await requestDockReservationAction(
        shipmentId,
        dockId,
        startAt.toISOString()
      );
      if (result?.error) toast.error(result.error);
      else toast.success("Rampa talebiniz gönderildi, müşteri onayı bekleniyor.");
    });
  }

  return (
    <div className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarClock className="text-muted-foreground size-4" />
        Rampa & Saat Seçin
      </div>
      <p className="text-muted-foreground text-xs">
        Müşteri rampa takvimini size açtı. Uygun depo/rampa ve saati seçin;
        seçiminiz müşteri onayına gönderilecek.
      </p>

      <div className="flex flex-col gap-2">
        <Label className="text-xs">Depo / Rampa</Label>
        <Select
          value={dockId}
          onValueChange={(v) => {
            setDockId(v);
            setSlot("");
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seçin" />
          </SelectTrigger>
          <SelectContent>
            {docks.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                <span className="flex items-center gap-1.5">
                  <Warehouse className="size-3.5" />
                  {d.warehouseName} — {d.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`dock-date-${shipmentId}`} className="text-xs">
            Tarih
          </Label>
          <Input
            id={`dock-date-${shipmentId}`}
            type="date"
            min={todayStr()}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSlot("");
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-xs">Saat</Label>
          <Select
            value={slot}
            onValueChange={setSlot}
            disabled={!selectedDock || !date || slots.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  !selectedDock || !date
                    ? "Önce rampa/tarih"
                    : slots.length === 0
                      ? "Uygun saat yok"
                      : "Seçin"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {slots.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isPending || !dockId || !date || !slot}
        className="w-fit"
      >
        {isPending && <Loader2 className="animate-spin" />}
        Talebi Gönder
      </Button>
    </div>
  );
}
