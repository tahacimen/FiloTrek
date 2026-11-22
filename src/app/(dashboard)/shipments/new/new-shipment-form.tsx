"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  createShipmentAction,
  type ShipmentFormState,
} from "@/app/(dashboard)/shipments/actions";
import { DangerousGoodsFields } from "@/app/(dashboard)/shipments/dangerous-goods-fields";
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
import { Textarea } from "@/components/ui/textarea";
import { TransportModeSelect } from "@/components/transport-mode-select";
import { confirmSubmit } from "@/lib/confirm-submit";
import {
  loadTypeLabels,
  loadTypesForMode,
  MODE_FIELD_LABELS,
  modeFields,
} from "@/lib/transport-mode";
import { TransportMode } from "@/generated/prisma/enums";
import type { Company } from "@/generated/prisma/client";

export function NewShipmentForm({ customers }: { customers: Company[] }) {
  const [state, formAction, isPending] = useActionState<
    ShipmentFormState,
    FormData
  >(createShipmentAction, undefined);
  const [mode, setMode] = useState<TransportMode>(TransportMode.ROAD);
  const refFields = modeFields(mode);
  const loadTypes = loadTypesForMode(mode);

  return (
    <form
      action={formAction}
      onSubmit={confirmSubmit("Sefer oluşturmak istediğinize emin misiniz?")}
      className="flex flex-col gap-4"
    >
      {/* Transport mode drives which reference fields apply; ROAD assigns a
          vehicle+driver later, SEA/AIR carry carrier + booking/AWB. */}
      <input type="hidden" name="transportMode" value={mode} />
      <div className="flex flex-col gap-2">
        <Label>Taşıma Modu</Label>
        <TransportModeSelect value={mode} onChange={setMode} />
      </div>

      {mode !== TransportMode.ROAD && (
        <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-3">
          {loadTypes.length > 0 && (
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="loadType">Yük Tipi</Label>
              <select
                id="loadType"
                name="loadType"
                defaultValue=""
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="">Seçin</option>
                {loadTypes.map((lt) => (
                  <option key={lt} value={lt}>
                    {loadTypeLabels[lt]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {refFields.map((f) => (
            <div
              key={f}
              className={
                f === "carrierName"
                  ? "col-span-2 flex flex-col gap-2"
                  : "flex flex-col gap-2"
              }
            >
              <Label htmlFor={f}>{MODE_FIELD_LABELS[f]}</Label>
              <Input id={f} name={f} />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="customerCompanyId">Müşteri Firma</Label>
        <Select name="customerCompanyId" required>
          <SelectTrigger id="customerCompanyId" className="w-full">
            <SelectValue placeholder="Bir müşteri seçin" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="originAddress">Yükleme Noktası</Label>
          <Input id="originAddress" name="originAddress" required placeholder="İstanbul" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="destinationAddress">Teslimat Noktası</Label>
          <Input
            id="destinationAddress"
            name="destinationAddress"
            required
            placeholder="İzmir"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="distanceKm">Mesafe (km)</Label>
          <Input
            id="distanceKm"
            name="distanceKm"
            type="number"
            step="1"
            min="0"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tonnage">Tonaj (ton)</Label>
          <Input
            id="tonnage"
            name="tonnage"
            type="number"
            step="0.1"
            min="0"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cargoDescription">Yük Açıklaması (opsiyonel)</Label>
        <Textarea id="cargoDescription" name="cargoDescription" rows={3} />
      </div>

      <DangerousGoodsFields />

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending && <Loader2 className="animate-spin" />}
        Sefer Oluştur
      </Button>
    </form>
  );
}
