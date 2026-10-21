"use client";

import { Navigation } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadReadyDialog } from "@/app/(dashboard)/shipments/[id]/load-ready-dialog";
import type { ShipmentStatus } from "@/generated/prisma/enums";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

/**
 * Role- and status-aware: renders nothing until there's something to submit
 * or something to show, so the caller doesn't need to gate this per role
 * like ShipmentStatusActions is gated on the page. The pasted Maps link
 * surfaces here as the clickable "Navigasyonu Başlat" link for whichever
 * side is looking — suppliers have no separate driver-facing screen (drivers
 * never get logins), so this shipment-details view is that surface.
 */
export function LoadReadyCard({
  shipmentId,
  status,
  companyType,
  originAddress,
  destinationAddress,
  pickupGateInfo,
  pickupMapsUrl,
  loadReadyAt,
}: {
  shipmentId: string;
  status: ShipmentStatus;
  companyType: "SUPPLIER" | "CUSTOMER";
  originAddress: string;
  destinationAddress: string;
  pickupGateInfo: string | null;
  pickupMapsUrl: string | null;
  loadReadyAt: Date | null;
}) {
  // Re-submission (to fix a typo'd address/link) is only offered while the
  // vehicle hasn't been sent off yet — the server enforces the same ASSIGNED
  // requirement (see markShipmentLoadReady), this just mirrors it in the UI.
  const canSubmit = companyType === "CUSTOMER" && status === "ASSIGNED";

  if (!loadReadyAt && !canSubmit) return null;

  const route = `${originAddress} → ${destinationAddress}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yükleme Bilgileri</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* N6: once the customer marks the cargo ready, cue the supplier that
            they can dispatch the driver (the WhatsApp handoff lives in the
            separate NotifyDriverCard). */}
        {loadReadyAt && companyType === "SUPPLIER" && status === "ASSIGNED" && (
          <div className="rounded-lg border-[1.5px] border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-900">
            ✅ Müşteri yükün hazır olduğunu bildirdi — şoförü yönlendirebilirsiniz.
          </div>
        )}
        {loadReadyAt ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Kapı / Rampa Bilgisi" value={pickupGateInfo} />
            <Field
              label="Navigasyon"
              value={
                pickupMapsUrl ? (
                  <a
                    href={pickupMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    <Navigation className="size-3.5" />
                    Navigasyonu Başlat
                  </a>
                ) : (
                  "Paylaşılmadı"
                )
              }
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Yük hazır olduğunda kapı/rampa bilgisini ve varsa konum linkini
            paylaşarak tedarikçiyi bilgilendirebilirsiniz.
          </p>
        )}
        {canSubmit && (
          <LoadReadyDialog
            shipmentId={shipmentId}
            route={route}
            pickupGateInfo={pickupGateInfo}
            pickupMapsUrl={pickupMapsUrl}
            triggerLabel={
              loadReadyAt ? "Bilgileri Güncelle" : "Yük Hazır, Aracı Gönder"
            }
            triggerVariant={loadReadyAt ? "outline" : "default"}
          />
        )}
      </CardContent>
    </Card>
  );
}
