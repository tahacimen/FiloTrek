"use client";

import { useActionState } from "react";
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
import { confirmSubmit } from "@/lib/confirm-submit";
import type { Company } from "@/generated/prisma/client";

export function NewShipmentForm({ customers }: { customers: Company[] }) {
  const [state, formAction, isPending] = useActionState<
    ShipmentFormState,
    FormData
  >(createShipmentAction, undefined);

  return (
    <form
      action={formAction}
      onSubmit={confirmSubmit("Sefer oluşturmak istediğinize emin misiniz?")}
      className="flex flex-col gap-4"
    >
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
