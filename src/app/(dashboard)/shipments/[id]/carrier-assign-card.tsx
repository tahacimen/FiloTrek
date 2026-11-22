"use client";

import { useActionState } from "react";
import { Loader2, Plane, Ship } from "lucide-react";

import {
  assignCarrierAction,
  type ShipmentFormState,
} from "@/app/(dashboard)/shipments/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  loadTypeLabels,
  loadTypesForMode,
  MODE_FIELD_LABELS,
  modeFields,
  transportModeLabels,
} from "@/lib/transport-mode";
import { confirmSubmit } from "@/lib/confirm-submit";
import { TransportMode } from "@/generated/prisma/enums";

/**
 * Multimodal: the SEA/AIR assignment card on the shipment detail — the
 * counterpart of the road "Atama" screen. The supplier records the carrier +
 * booking/container (SEA) or airwaybill/flight (AIR), which moves the shipment
 * to ASSIGNED. For a direct request the supplier also proposes a price; a
 * bid-accepted shipment already has one, so the price field is hidden.
 */
export function CarrierAssignCard({
  shipmentId,
  mode,
  priceAlreadyAgreed,
}: {
  shipmentId: string;
  // Only ever rendered for SEA/AIR, but typed broadly to avoid enum-narrowing
  // friction at the call site.
  mode: TransportMode;
  priceAlreadyAgreed: boolean;
}) {
  const [state, formAction, isPending] = useActionState<
    ShipmentFormState,
    FormData
  >(assignCarrierAction.bind(null, shipmentId), undefined);

  const refFields = modeFields(mode);
  const loadTypes = loadTypesForMode(mode);
  const Icon = mode === TransportMode.SEA ? Ship : Plane;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="text-muted-foreground size-4" />
          Taşıyıcı Ata ({transportModeLabels[mode]})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={formAction}
          onSubmit={confirmSubmit(
            "Bu seferi bu taşıyıcıya atamak istediğinize emin misiniz?"
          )}
          className="flex flex-col gap-4"
        >
          <p className="text-muted-foreground text-sm">
            Bu sefer {transportModeLabels[mode].toLocaleLowerCase("tr-TR")} ile
            taşınacak; araç/şoför yerine taşıyıcı ve referans bilgilerini girin.
          </p>

          {loadTypes.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="loadType">Yük Tipi</Label>
              <select
                id="loadType"
                name="loadType"
                defaultValue=""
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
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

          <div className="grid gap-4 sm:grid-cols-2">
            {refFields.map((f) => (
              <div
                key={f}
                className={
                  f === "carrierName"
                    ? "sm:col-span-2 flex flex-col gap-2"
                    : "flex flex-col gap-2"
                }
              >
                <Label htmlFor={f}>
                  {MODE_FIELD_LABELS[f]}
                  {f === "carrierName" && " *"}
                </Label>
                <Input id={f} name={f} required={f === "carrierName"} />
              </div>
            ))}
          </div>

          {!priceAlreadyAgreed && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="agreedPrice">Nakliye Fiyatı (₺) *</Label>
              <Input
                id="agreedPrice"
                name="agreedPrice"
                type="number"
                step="0.01"
                min="0"
                required
              />
              <p className="text-muted-foreground text-xs">
                Teklifiniz müşterinin onayına gönderilir.
              </p>
            </div>
          )}

          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}

          <Button type="submit" disabled={isPending} className="w-fit">
            {isPending ? <Loader2 className="animate-spin" /> : <Icon />}
            Taşıyıcıyı Ata
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
