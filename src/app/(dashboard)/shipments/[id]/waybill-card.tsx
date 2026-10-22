"use client";

import { useTransition } from "react";
import { CheckCircle2, FileCheck2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { confirmWaybillAction } from "@/app/(dashboard)/shipments/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ShipmentStatus } from "@/generated/prisma/enums";

/**
 * G3: the stamped waybill (irsaliye) on the shipment detail. Shows the photo
 * link once the driver has uploaded it, and — for the supplier — the confirm
 * action that unblocks completion. Both sides see the confirmation state.
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
  const [isPending, startTransition] = useTransition();

  // Nothing to show until there's a waybill or we're at/after the delivery
  // point (where it becomes relevant).
  const relevant =
    waybillPhotoUrl != null ||
    status === "AT_DELIVERY_POINT" ||
    status === "COMPLETED";
  if (!relevant) return null;

  function handleConfirm() {
    startTransition(async () => {
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
            Şoför henüz irsaliyeyi yüklemedi.
          </p>
        )}

        {confirmed ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-700">
            <CheckCircle2 className="size-4" /> İrsaliye onaylandı.
          </p>
        ) : waybillPhotoUrl && companyType === "SUPPLIER" ? (
          <Button onClick={handleConfirm} disabled={isPending} className="w-fit">
            {isPending && <Loader2 className="animate-spin" />}
            İrsaliyeyi Onayla
          </Button>
        ) : waybillPhotoUrl ? (
          <p className="text-muted-foreground text-sm">
            Nakliyeci onayı bekleniyor.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
