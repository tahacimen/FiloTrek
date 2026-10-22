"use client";

import { useActionState } from "react";
import { CheckCircle2, FileCheck2, Loader2, Upload } from "lucide-react";

import {
  uploadWaybillAction,
  type DriverShipmentFormState,
} from "@/app/(driver)/driver/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * G3: driver uploads the stamped & signed waybill (irsaliye) at the delivery
 * point. Shows the current state — not yet uploaded / awaiting supplier
 * confirmation / confirmed — so the driver knows why completion is or isn't
 * available yet.
 */
export function DriverWaybillActions({
  shipmentId,
  hasWaybill,
  confirmed,
}: {
  shipmentId: string;
  hasWaybill: boolean;
  confirmed: boolean;
}) {
  const [state, formAction, isPending] = useActionState<
    DriverShipmentFormState,
    FormData
  >(uploadWaybillAction.bind(null, shipmentId), undefined);

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileCheck2 className="text-muted-foreground size-4" />
        Kaşeli-İmzalı İrsaliye
      </div>
      {confirmed ? (
        <p className="flex items-center gap-1.5 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" /> İrsaliye onaylandı — teslimatı
          tamamlayabilirsiniz.
        </p>
      ) : hasWaybill ? (
        <p className="text-muted-foreground text-sm">
          İrsaliye yüklendi, nakliyeci onayı bekleniyor. Gerekirse yeniden
          yükleyebilirsiniz.
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          Teslimatı tamamlamak için kaşeli-imzalı irsaliyenin fotoğrafını
          yükleyin.
        </p>
      )}
      <form action={formAction} className="flex flex-col gap-2">
        <Label htmlFor={`waybill-${shipmentId}`} className="sr-only">
          İrsaliye fotoğrafı
        </Label>
        <Input
          id={`waybill-${shipmentId}`}
          name="photo"
          type="file"
          accept="image/*"
          capture="environment"
          required
        />
        {state?.error && (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={isPending} variant="outline" className="self-start">
          {isPending ? <Loader2 className="animate-spin" /> : <Upload />}
          {hasWaybill ? "İrsaliyeyi Yeniden Yükle" : "İrsaliyeyi Yükle"}
        </Button>
      </form>
    </div>
  );
}
