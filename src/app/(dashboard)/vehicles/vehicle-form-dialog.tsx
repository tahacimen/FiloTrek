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
import { COUNTRIES, DEFAULT_COUNTRY } from "@/lib/countries";
import type { SerializableVehicle } from "@/app/(dashboard)/vehicles/types";

/** Format a date (or ISO string) as YYYY-MM-DD for an <input type="date">. */
function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

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
  const [country, setCountry] = useState(vehicle?.country ?? DEFAULT_COUNTRY);

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
          <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-4">
            <div className="flex flex-col gap-2">
              <Label>Ülke</Label>
              <input type="hidden" name="country" value={country} />
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="plate">Plaka</Label>
              <Input
                id="plate"
                name="plate"
                required
                defaultValue={vehicle?.plate}
                placeholder={country === "TR" ? "34 ABC 123" : "Plaka"}
              />
            </div>
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

          <div className="mt-1 border-t pt-4">
            <p className="mb-1 text-sm font-medium">Belge & Geçerlilik</p>
            <p className="text-muted-foreground mb-3 text-xs">
              Yasal takip için tüm belge bilgileri zorunludur.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="registrationNumber">Ruhsat / Tescil No</Label>
                <Input
                  id="registrationNumber"
                  name="registrationNumber"
                  required
                  defaultValue={vehicle?.registrationNumber ?? ""}
                  placeholder="örn. AB123456"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="inspectionExpiry">Muayene Bitiş</Label>
                <Input
                  id="inspectionExpiry"
                  name="inspectionExpiry"
                  type="date"
                  required
                  defaultValue={toDateInput(vehicle?.inspectionExpiry)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="insurancePolicyNumber">Trafik Sig. Poliçe No</Label>
                <Input
                  id="insurancePolicyNumber"
                  name="insurancePolicyNumber"
                  required
                  defaultValue={vehicle?.insurancePolicyNumber ?? ""}
                  placeholder="örn. 1234567890"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="insuranceExpiry">Sigorta Bitiş</Label>
                <Input
                  id="insuranceExpiry"
                  name="insuranceExpiry"
                  type="date"
                  required
                  defaultValue={toDateInput(vehicle?.insuranceExpiry)}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Label htmlFor="registrationPhoto">
                Ruhsat Fotoğrafı{isEdit ? " (değiştirmek için seçin)" : ""}
              </Label>
              <Input
                id="registrationPhoto"
                name="registrationPhoto"
                type="file"
                accept="image/*"
                required={!isEdit}
              />
              {isEdit && vehicle?.registrationPhotoUrl && (
                <a
                  href={`/api/vehicle-docs/${vehicle.registrationPhotoUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary w-fit text-sm underline underline-offset-2"
                >
                  Mevcut ruhsatı görüntüle
                </a>
              )}
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
