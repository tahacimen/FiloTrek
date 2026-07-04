"use client";

import { useActionState, useState } from "react";
import { Loader2, Truck } from "lucide-react";

import {
  assignShipmentAction,
  type AssignFormState,
} from "@/app/(dashboard)/assign/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { vehicleTypeLabels } from "@/lib/labels";
import { confirmSubmit } from "@/lib/confirm-submit";
import type { SerializableDriver } from "@/app/(dashboard)/drivers/types";
import type { SerializableVehicle } from "@/app/(dashboard)/vehicles/types";

export function AssignDialog({
  shipmentId,
  route,
  availableVehicles,
  availableDrivers,
}: {
  shipmentId: string;
  route: string;
  availableVehicles: SerializableVehicle[];
  availableDrivers: SerializableDriver[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    AssignFormState,
    FormData
  >(assignShipmentAction.bind(null, shipmentId), undefined);

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

  const noCapacity = availableVehicles.length === 0 || availableDrivers.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Truck />
          Ata
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Araç ve Şoför Ata</DialogTitle>
          <DialogDescription>{route}</DialogDescription>
        </DialogHeader>
        {noCapacity ? (
          <p className="text-muted-foreground text-sm">
            Müsait araç veya şoför bulunmuyor. Atama yapabilmek için en az bir
            müsait araç ve şoför gerekir.
          </p>
        ) : (
          <form
            action={formAction}
            onSubmit={confirmSubmit(
              "Bu araç ve şoförü sefere atamak istediğinize emin misiniz?"
            )}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor={`vehicle-${shipmentId}`}>Araç</Label>
              <Select name="vehicleId" required>
                <SelectTrigger id={`vehicle-${shipmentId}`} className="w-full">
                  <SelectValue placeholder="Müsait araç seçin" />
                </SelectTrigger>
                <SelectContent>
                  {availableVehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate} — {vehicleTypeLabels[vehicle.vehicleType]} (
                      {vehicle.tonnageCapacity.toString()} ton)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`driver-${shipmentId}`}>Şoför</Label>
              <Select name="driverId" required>
                <SelectTrigger id={`driver-${shipmentId}`} className="w-full">
                  <SelectValue placeholder="Müsait şoför seçin" />
                </SelectTrigger>
                <SelectContent>
                  {availableDrivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`price-${shipmentId}`}>Nakliye Fiyatı (₺)</Label>
              <Input
                id={`price-${shipmentId}`}
                name="agreedPrice"
                type="number"
                step="0.01"
                min="0.01"
                required
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
                Sefere Ata
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
