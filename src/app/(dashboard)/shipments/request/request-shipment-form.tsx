"use client";

import { useActionState } from "react";
import { Loader2, Truck } from "lucide-react";

import {
  createShipmentRequestAction,
  type ShipmentFormState,
} from "@/app/(dashboard)/shipments/actions";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { confirmSubmit } from "@/lib/confirm-submit";
import type { Company } from "@/generated/prisma/client";

export function RequestShipmentForm({ suppliers }: { suppliers: Company[] }) {
  const [state, formAction, isPending] = useActionState<
    ShipmentFormState,
    FormData
  >(createShipmentRequestAction, undefined);

  return (
    <form
      action={formAction}
      onSubmit={confirmSubmit("Araç çağırmak istediğinize emin misiniz?")}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="supplierCompanyId">Tedarikçi Firma</Label>
        <Select name="supplierCompanyId" required>
          <SelectTrigger id="supplierCompanyId" className="w-full">
            <SelectValue placeholder="Bir tedarikçi seçin" />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
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

      <Separator />

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-medium">Kapı Rezervasyonu</h3>
          <p className="text-muted-foreground text-xs">
            Yükleme ve teslimat noktaları için Google Maps konum linki
            paylaşabilirsiniz — tedarikçi bu linkleri görebilir ama
            değiştiremez.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="originMapsUrl">
              Yükleme Noktası Linki (opsiyonel)
            </Label>
            <Input
              id="originMapsUrl"
              name="originMapsUrl"
              type="url"
              placeholder="https://maps.google.com/..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="destinationMapsUrl">
              Teslimat Noktası Linki (opsiyonel)
            </Label>
            <Input
              id="destinationMapsUrl"
              name="destinationMapsUrl"
              type="url"
              placeholder="https://maps.google.com/..."
            />
          </div>
        </div>
      </div>

      <Separator />

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
        <Label htmlFor="documentTrackingNumber">
          Belge Takip Numarası (opsiyonel)
        </Label>
        <Input
          id="documentTrackingNumber"
          name="documentTrackingNumber"
          placeholder="İrsaliye/fatura süreciyle eşleştirmek için"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cargoDescription">Yük Açıklaması (opsiyonel)</Label>
        <Textarea id="cargoDescription" name="cargoDescription" rows={3} />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? <Loader2 className="animate-spin" /> : <Truck />}
        Araç Çağır
      </Button>
    </form>
  );
}
