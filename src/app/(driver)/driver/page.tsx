import { Navigation } from "lucide-react";

import { requireDriverContext } from "@/core/shared/driver-context";
import { listActiveShipmentsForDriver } from "@/core/shipment/shipment-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  driverNextStepLabels,
  shipmentStatusLabels,
  statusBadgeVariant,
} from "@/lib/labels";
import { DRIVER_NEXT_TARGET_STATUS } from "@/core/shipment/shipment-transitions";
import { DriverShipmentActions } from "@/app/(driver)/driver/driver-shipment-actions";
import { DriverIncidentActions } from "@/app/(driver)/driver/incident-actions";
import { LocationReporter } from "@/app/(driver)/driver/location-reporter";

const LOCATION_SHARING_STATUSES = new Set(["HEADING_TO_PICKUP", "EN_ROUTE"]);

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function NavigationLink({ url }: { url: string | null | undefined }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary inline-flex items-center gap-1 text-sm underline underline-offset-2"
    >
      <Navigation className="size-3.5" />
      Navigasyonu Başlat
    </a>
  );
}

export default async function DriverPage() {
  const driverCtx = await requireDriverContext();
  const shipments = await listActiveShipmentsForDriver(driverCtx);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Seferlerim
        </h1>
        <p className="text-muted-foreground text-sm">
          Size atanmış aktif seferler ve yapmanız gereken bir sonraki adım.
        </p>
      </div>

      {shipments.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Şu anda size atanmış aktif bir sefer bulunmuyor.
          </CardContent>
        </Card>
      ) : (
        shipments.map((shipment) => {
          const nextTargetStatus = DRIVER_NEXT_TARGET_STATUS[shipment.status];
          // Whichever navigation link is relevant right now: before pickup,
          // the customer's request-time / load-ready links; once handed
          // off, the delivery destination.
          const navUrl =
            shipment.status === "EN_ROUTE" ||
            shipment.status === "AT_DELIVERY_POINT"
              ? shipment.destinationMapsUrl
              : (shipment.pickupMapsUrl ?? shipment.originMapsUrl);

          return (
            <Card key={shipment.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {shipment.originAddress} → {shipment.destinationAddress}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {shipment.hasOpenIncident && (
                      <Badge variant="destructive">Arıza</Badge>
                    )}
                    <Badge variant={statusBadgeVariant[shipment.status]}>
                      {shipmentStatusLabels[shipment.status]}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Müşteri" value={shipment.customerCompany.name} />
                  <Field label="Tonaj" value={`${shipment.tonnage.toString()} ton`} />
                  {shipment.pickupGateInfo && (
                    <div className="col-span-full">
                      <Field
                        label="Kapı / Rampa Bilgisi"
                        value={shipment.pickupGateInfo}
                      />
                    </div>
                  )}
                  {shipment.cargoDescription && (
                    <div className="col-span-full">
                      <Field
                        label="Yük Açıklaması"
                        value={shipment.cargoDescription}
                      />
                    </div>
                  )}
                </div>

                <NavigationLink url={navUrl} />
                {LOCATION_SHARING_STATUSES.has(shipment.status) && (
                  <LocationReporter shipmentId={shipment.id} />
                )}

                {nextTargetStatus ? (
                  <DriverShipmentActions
                    shipmentId={shipment.id}
                    targetStatus={nextTargetStatus}
                    label={driverNextStepLabels[shipment.status]!}
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Sevkiyat bekleniyor — tedarikçi aracı yola çıkardığında
                    burada bir sonraki adımı görebileceksiniz.
                  </p>
                )}

                <DriverIncidentActions
                  shipmentId={shipment.id}
                  hasOpenIncident={shipment.hasOpenIncident}
                  route={`${shipment.originAddress} → ${shipment.destinationAddress}`}
                />
              </CardContent>
            </Card>
          );
        })
      )}
    </>
  );
}
