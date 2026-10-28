"use client";

import { useActionState, useTransition } from "react";
import { CheckCircle2, FileCheck2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  confirmWaybillAction,
  uploadWaybillSupplierAction,
  type ShipmentFormState,
} from "@/app/(dashboard)/shipments/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShipmentStatus } from "@/generated/prisma/enums";

/**
 * G3: the stamped waybill (irsaliye) on the shipment detail. The driver uploads
 * it from their own panel when they have a login; when they don't, the supplier
 * uploads it here themselves (auto-confirmed). The supplier can also confirm a
 * driver-uploaded one. Completion is gated on an uploaded + confirmed waybill.
 */
export function WaybillCard({
  shipmentId,
  companyType,
  status,
  waybillPhotoUrl,
  confirmed,
}: {
  shipmentId: string;
  companyType: "SUPPLIER" | "CUSTOMER";
  status: ShipmentStatus;
  waybillPhotoUrl: string | null;
  confirmed: boolean;
}) {
  const [isConfirming, startConfirm] = useTransition();
  const [uploadState, uploadAction, isUploading] = useActionState<
    ShipmentFormState,
    FormData
  >(uploadWaybillSupplierAction.bind(null, shipmentId), undefined);

  const atDelivery = status === "AT_DELIVERY_POINT";
  const relevant = waybillPhotoUrl != null || atDelivery || status === "COMPLETED";
  if (!relevant) return null;

  const isSupplier = companyType === "SUPPLIER";
  const canSupplierAct = isSupplier && atDelivery;

  function handleConfirm() {
    startConfirm(async () => {
      const result = await confirmWaybillAction(shipmentId);
      if (result?.error) toast.error(result.error);
      else toast.success("İrsaliye onaylandı.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck2 className="text-muted-foreground size-4" />
          Kaşeli-İmzalı İrsaliye
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {waybillPhotoUrl ? (
          <a
            href={`/api/uploads/${waybillPhotoUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary w-fit underline underline-offset-2"
          >
            İrsaliyeyi Görüntüle
          </a>
        ) : (
          <p className="text-muted-foreground text-sm">
            İrsaliye henüz yüklenmedi.
          </p>
        )}

        {confirmed && (
          <p className="flex items-center gap-1.5 text-sm text-emerald-700">
            <CheckCircle2 className="size-4" /> İrsaliye onaylandı.
          </p>
        )}

        {/* Supplier can confirm a driver-uploaded waybill that isn't confirmed. */}
        {!confirmed && waybillPhotoUrl && canSupplierAct && (
          <Button onClick={handleConfirm} disabled={isConfirming} className="w-fit">
            {isConfirming && <Loader2 className="animate-spin" />}
            İrsaliyeyi Onayla
          </Button>
        )}

        {/* Supplier uploads the waybill themselves (e.g. driver has no login).
            Shown when none is uploaded yet, or to replace an unconfirmed one. */}
        {canSupplierAct && !confirmed && (
          <form action={uploadAction} className="flex flex-col gap-2 border-t pt-3">
            <Label htmlFor={`waybill-sup-${shipmentId}`} className="text-sm">
              {waybillPhotoUrl
                ? "İrsaliyeyi siz yükleyin (yeniden)"
                : "İrsaliyeyi siz yükleyin"}
            </Label>
            <p className="text-muted-foreground text-xs">
              Şoförün uygulama girişi yoksa kaşeli-imzalı irsaliyenin fotoğrafını
              buradan yükleyebilirsiniz; yüklediğinizde onaylanmış sayılır.
            </p>
            <Input
              id={`waybill-sup-${shipmentId}`}
              name="photo"
              type="file"
              accept="image/*"
              required
            />
            {uploadState?.error && (
              <p className="text-sm text-destructive" role="alert">
                {uploadState.error}
              </p>
            )}
            <Button type="submit" variant="outline" disabled={isUploading} className="w-fit">
              {isUploading ? <Loader2 className="animate-spin" /> : <Upload />}
              İrsaliyeyi Yükle
            </Button>
          </form>
        )}

        {/* Customer waiting view. */}
        {!isSupplier && !confirmed && waybillPhotoUrl && (
          <p className="text-muted-foreground text-sm">Nakliyeci onayı bekleniyor.</p>
        )}
      </CardContent>
    </Card>
  );
}
