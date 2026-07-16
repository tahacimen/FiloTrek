"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  createReservationAction,
  type ReservationFormState,
} from "@/app/(dashboard)/warehouses/[warehouseId]/docks/[dockId]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { confirmSubmit } from "@/lib/confirm-submit";
import { dockReservationTypeLabels, vehicleTypeLabels } from "@/lib/labels";
import type { WeekGridCell } from "@/lib/dock-calendar";
import type { DockReservationType, VehicleType } from "@/generated/prisma/client";

const NONE = "__none__";

export function ReservationFormDialog({
  warehouseId,
  dockId,
  cell,
  supportedReservationTypes,
  supportedVehicleTypes,
  onClose,
}: {
  warehouseId: string;
  dockId: string;
  cell: WeekGridCell;
  supportedReservationTypes: DockReservationType[];
  supportedVehicleTypes: VehicleType[];
  onClose: () => void;
}) {
  const action = createReservationAction.bind(null, warehouseId, dockId);
  const [state, formAction, isPending] = useActionState<
    ReservationFormState,
    FormData
  >(action, undefined);

  const [wasPending, setWasPending] = useState(isPending);
  if (wasPending !== isPending) {
    setWasPending(isPending);
    if (wasPending && !state?.error) {
      onClose();
    }
  }

  const [reservationType, setReservationType] = useState<DockReservationType>(
    supportedReservationTypes[0]
  );
  const [reason, setReason] = useState("");
  const [vehicleType, setVehicleType] = useState<string>(NONE);
  const [cargoType, setCargoType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [totalWeightKg, setTotalWeightKg] = useState("");
  const [plate, setPlate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [notes, setNotes] = useState("");

  const payload = JSON.stringify({
    reservationType,
    startAt: cell.start.toISOString(),
    reason,
    vehicleType: vehicleType === NONE ? null : vehicleType,
    cargoType: cargoType.trim() === "" ? null : cargoType,
    quantity: quantity.trim() === "" ? null : Number(quantity),
    totalWeightKg: totalWeightKg.trim() === "" ? null : Number(totalWeightKg),
    plate,
    driverName,
    driverPhone: driverPhone.trim() === "" ? null : driverPhone,
    notes: notes.trim() === "" ? null : notes,
  });

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Yeni Rezervasyon —{" "}
            {cell.start.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
            {" "}
            {cell.timeLabel}
          </DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={confirmSubmit("Bu rezervasyonu oluşturmak istediğinize emin misiniz?")}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="payload" value={payload} readOnly />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Rezervasyon Türü</Label>
              <Select
                value={reservationType}
                onValueChange={(v) => setReservationType(v as DockReservationType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supportedReservationTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {dockReservationTypeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Araç Türü</Label>
              <Select value={vehicleType} onValueChange={setVehicleType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Belirtilmedi</SelectItem>
                  {supportedVehicleTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {vehicleTypeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">Rezervasyon Gerekçesi</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="Örn. Palet yükleme"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cargoType">Yük Tipi</Label>
              <Input
                id="cargoType"
                value={cargoType}
                onChange={(e) => setCargoType(e.target.value)}
                placeholder="Örn. Palet"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="quantity">Adet</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="totalWeightKg">Toplam Ağırlık (kg)</Label>
              <Input
                id="totalWeightKg"
                type="number"
                min="0"
                step="0.1"
                value={totalWeightKg}
                onChange={(e) => setTotalWeightKg(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="plate">Plaka</Label>
              <Input
                id="plate"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                required
                placeholder="34 ABC 123"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="driverName">Sürücü Adı</Label>
              <Input
                id="driverName"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="driverPhone">Sürücü Telefon</Label>
              <Input
                id="driverPhone"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Ek Notlar</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
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
              Rezervasyon Oluştur
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
