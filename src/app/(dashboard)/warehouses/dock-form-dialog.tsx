"use client";

import { useActionState, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import {
  createDockAction,
  updateDockAction,
  type WarehouseFormState,
} from "@/app/(dashboard)/warehouses/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { DAY_LABELS } from "@/lib/dock-calendar";
import {
  dockReservationTypeLabels,
  vehicleBedTypeLabels,
  vehicleTypeLabels,
} from "@/lib/labels";
import { confirmSubmit } from "@/lib/confirm-submit";
import type { DockWorkingHours, LoadingDock } from "@/generated/prisma/client";
import {
  DockReservationType,
  VehicleBedType,
  VehicleType,
} from "@/generated/prisma/enums";

export type DockWithHours = LoadingDock & { workingHours: DockWorkingHours[] };

type WorkingHourRow = {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

const DEFAULT_WORKING_HOURS: WorkingHourRow[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  isOpen: dayOfWeek >= 1 && dayOfWeek <= 6,
  openTime: "09:00",
  closeTime: "18:00",
}));

function toRows(dock: DockWithHours | undefined): WorkingHourRow[] {
  if (!dock) return DEFAULT_WORKING_HOURS;
  const byDay = new Map(dock.workingHours.map((row) => [row.dayOfWeek, row]));
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const row = byDay.get(dayOfWeek);
    return {
      dayOfWeek,
      isOpen: row?.isOpen ?? false,
      openTime: row?.openTime ?? "09:00",
      closeTime: row?.closeTime ?? "18:00",
    };
  });
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function DockFormDialog({
  warehouseId,
  dock,
}: {
  warehouseId: string;
  dock?: DockWithHours;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!dock;
  const action = isEdit
    ? updateDockAction.bind(null, dock.id)
    : createDockAction.bind(null, warehouseId);
  const [state, formAction, isPending] = useActionState<
    WarehouseFormState,
    FormData
  >(action, undefined);

  const [wasPending, setWasPending] = useState(isPending);
  if (wasPending !== isPending) {
    setWasPending(isPending);
    if (wasPending && open && !state?.error) {
      setOpen(false);
    }
  }

  const [name, setName] = useState(dock?.name ?? "");
  const [reservationTypes, setReservationTypes] = useState<DockReservationType[]>(
    dock?.supportedReservationTypes ?? []
  );
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>(
    dock?.supportedVehicleTypes ?? []
  );
  const [bedTypes, setBedTypes] = useState<VehicleBedType[]>(
    dock?.supportedBedTypes ?? []
  );
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(
    dock?.slotDurationMinutes ?? 60
  );
  const [workingHours, setWorkingHours] = useState<WorkingHourRow[]>(toRows(dock));

  function updateRow(dayOfWeek: number, patch: Partial<WorkingHourRow>) {
    setWorkingHours((rows) =>
      rows.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row))
    );
  }

  const payload = JSON.stringify({
    name,
    supportedReservationTypes: reservationTypes,
    supportedVehicleTypes: vehicleTypes,
    supportedBedTypes: bedTypes,
    slotDurationMinutes,
    workingHours,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon">
            <Pencil />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <Plus />
            Yeni Rampa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rampayı Düzenle" : "Yeni Rampa Ekle"}</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={confirmSubmit(
            isEdit
              ? "Rampa ayarlarını kaydetmek istediğinize emin misiniz?"
              : "Yeni rampa eklemek istediğinize emin misiniz?"
          )}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="payload" value={payload} readOnly />

          <div className="flex flex-col gap-2">
            <Label htmlFor="dockName">Rampa Adı</Label>
            <Input
              id="dockName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Rampa 1"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Rezervasyon Tipleri</Label>
            <div className="flex flex-wrap gap-4">
              {Object.entries(dockReservationTypeLabels).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={reservationTypes.includes(value as DockReservationType)}
                    onCheckedChange={() =>
                      setReservationTypes((list) =>
                        toggle(list, value as DockReservationType)
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Desteklenen Araç Tipleri</Label>
            <div className="flex flex-wrap gap-4">
              {Object.entries(vehicleTypeLabels).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={vehicleTypes.includes(value as VehicleType)}
                    onCheckedChange={() =>
                      setVehicleTypes((list) => toggle(list, value as VehicleType))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Desteklenen Kasa Tipleri</Label>
            <div className="flex flex-wrap gap-4">
              {Object.entries(vehicleBedTypeLabels).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={bedTypes.includes(value as VehicleBedType)}
                    onCheckedChange={() =>
                      setBedTypes((list) => toggle(list, value as VehicleBedType))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="slotDuration">Rezervasyon Slot Süresi (dakika)</Label>
            <Input
              id="slotDuration"
              type="number"
              min={15}
              max={480}
              step={15}
              value={slotDurationMinutes}
              onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Çalışma Saatleri</Label>
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              {workingHours.map((row) => (
                <div key={row.dayOfWeek} className="flex items-center gap-3">
                  <label className="flex w-32 shrink-0 items-center gap-2 text-sm">
                    <Checkbox
                      checked={row.isOpen}
                      onCheckedChange={(checked) =>
                        updateRow(row.dayOfWeek, { isOpen: checked === true })
                      }
                    />
                    {DAY_LABELS[row.dayOfWeek]}
                  </label>
                  <Input
                    type="time"
                    value={row.openTime}
                    disabled={!row.isOpen}
                    onChange={(e) => updateRow(row.dayOfWeek, { openTime: e.target.value })}
                    className="w-32"
                  />
                  <span className="text-muted-foreground text-sm">-</span>
                  <Input
                    type="time"
                    value={row.closeTime}
                    disabled={!row.isOpen}
                    onChange={(e) => updateRow(row.dayOfWeek, { closeTime: e.target.value })}
                    className="w-32"
                  />
                </div>
              ))}
            </div>
          </div>

          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              {isEdit ? "Kaydet" : "Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
