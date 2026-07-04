"use client";

import { useActionState, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import {
  createVehicleAction,
  updateVehicleAction,
  type VehicleFormState,
} from "@/app/(dashboard)/vehicles/actions";
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
import { vehicleBedTypeLabels, vehicleTypeLabels } from "@/lib/labels";
import { confirmSubmit } from "@/lib/confirm-submit";
import type { SerializableVehicle } from "@/app/(dashboard)/vehicles/types";

export function VehicleFormDialog({
  vehicle,
}: {
  vehicle?: SerializableVehicle;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!vehicle;
  const action = isEdit
    ? updateVehicleAction.bind(null, vehicle.id)
    : createVehicleAction;
  const [state, formAction, isPending] = useActionState<
    VehicleFormState,
    FormData
  >(action, undefined);

  // Close the dialog on a successful submission. Adjusted during render
  // (React's documented pattern for this) rather than in a useEffect, since
  // `state` alone can't distinguish "no submission yet" from "just
  // succeeded" (both are `undefined`) — the isPending transition can.
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
        {isEdit ? (
          <Button variant="ghost" size="icon">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus />
            Yeni Araç
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Aracı Düzenle" : "Yeni Araç Ekle"}</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={confirmSubmit(
            isEdit
              ? "Araç bilgilerini kaydetmek istediğinize emin misiniz?"
              : "Yeni araç eklemek istediğinize emin misiniz?"
          )}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="plate">Plaka</Label>
            <Input
              id="plate"
              name="plate"
              required
              defaultValue={vehicle?.plate}
              placeholder="34 ABC 123"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="vehicleType">Araç Tipi</Label>
              <Select name="vehicleType" defaultValue={vehicle?.vehicleType} required>
                <SelectTrigger id="vehicleType" className="w-full">
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(vehicleTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bedType">Kasa Tipi</Label>
              <Select name="bedType" defaultValue={vehicle?.bedType} required>
                <SelectTrigger id="bedType" className="w-full">
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(vehicleBedTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tonnageCapacity">Tonaj Kapasitesi (ton)</Label>
            <Input
              id="tonnageCapacity"
              name="tonnageCapacity"
              type="number"
              step="0.1"
              min="0"
              required
              defaultValue={vehicle?.tonnageCapacity.toString()}
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
              {isEdit ? "Kaydet" : "Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
