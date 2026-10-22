import { Navigation, Warehouse } from "lucide-react";

import { requireDriverContext } from "@/core/shared/driver-context";
import { listActiveShipmentsForDriver } from "@/core/shipment/shipment-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import {
  driverNextStepLabels,
  shipmentStatusLabels,
  statusBadgeVariant,
} from "@/lib/labels";
import { DRIVER_NEXT_TARGET_STATUS } from "@/core/shipment/shipment-transitions";
import { resolveNavUrl } from "@/lib/maps";
import { DriverShipmentActions } from "@/app/(driver)/driver/driver-shipment-actions";
import { DriverWaybillActions } from "@/app/(driver)/driver/driver-waybill-actions";
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

function NavigationLink({
  url,
  label = "Navigasyonu Başlat",
}: {
  url: string | null | undefined;
  label?: string;
}) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary inline-flex w-fit items-center gap-1 text-sm underline underline-offset-2"
    >
      <Navigation className="size-3.5" />
      {label}
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
          const reservation = shipment.dockReservations[0] ?? null;
          const isBeforePickup =
            shipment.status !== "EN_ROUTE" &&
            shipment.status !== "AT_DELIVERY_POINT";
          // Whichever navigation link is relevant right now: before pickup,
          // the reservation's warehouse (most precise) then the customer's
          // request-time / load-ready links; once handed off, the delivery
          // destination. resolveNavUrl falls back to a directions link built
          // from the address text, so the driver always gets a working link
          // even when no exact maps URL was entered.
          const navUrl = isBeforePickup
            ? resolveNavUrl(
                reservation?.dock.warehouse.mapsUrl ??
                  shipment.pickupMapsUrl ??
                  shipment.originMapsUrl,
                reservation?.dock.warehouse.address ?? shipment.originAddress
              )
            : resolveNavUrl(shipment.destinationMapsUrl, shipment.destinationAddress);

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

                {reservation && isBeforePickup && (
                  <div className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Warehouse className="text-muted-foreground size-4" />
                      Rampa Rezervasyonu
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Depo"
                        value={reservation.dock.warehouse.name}
                      />
                      <Field label="Rampa" value={reservation.dock.name} />
                      <Field
                        label="Planlanan Saat"
                        value={formatDateTime(reservation.startAt)}
                      />
                      {reservation.dock.warehouse.address && (
                        <div className="col-span-full">
                          <Field
                            label="Adres"
                            value={reservation.dock.warehouse.address}
                          />
                        </div>
                      )}
                    </div>
                    <NavigationLink
                      url={resolveNavUrl(
                        reservation.dock.warehouse.mapsUrl,
                        reservation.dock.warehouse.address
                      )}
                      label="Depoya Yol Tarifi"
                    />
                  </div>
                )}

                <NavigationLink
                  url={navUrl}
                  label={isBeforePickup ? "Yükleme Noktasına Yol Tarifi" : "Teslimat Noktasına Yol Tarifi"}
                />
                {LOCATION_SHARING_STATUSES.has(shipment.status) && (
                  <LocationReporter shipmentId={shipment.id} />
                )}

                {shipment.status === "AT_DELIVERY_POINT" ? (
                  // G3: irsaliye upload + confirmation gate before completion.
                  <div className="flex flex-col gap-3">
                    <DriverWaybillActions
                      shipmentId={shipment.id}
                      hasWaybill={shipment.waybillPhotoUrl != null}
                      confirmed={shipment.waybillConfirmedAt != null}
                    />
                    {shipment.waybillConfirmedAt != null ? (
                      <DriverShipmentActions
                        shipmentId={shipment.id}
                        targetStatus="COMPLETED"
                        label={driverNextStepLabels[shipment.status]!}
                      />
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Teslimatı tamamlamak için irsaliyenin nakliyeci
                        tarafından onaylanması gerekir.
                      </p>
                    )}
                  </div>
                ) : nextTargetStatus ? (
                  <DriverShipmentActions
                    shipmentId={shipment.id}
                    targetStatus={nextTargetStatus}
                    label={driverNextStepLabels[shipment.status]!}
                  />
                ) : shipment.status === "ASSIGNED" ? (
                  shipment.loadReadyAt && shipment.priceApprovedAt ? (
                    // N6: cargo ready + price approved → green light to head out.
                    <div className="flex flex-col gap-3">
                      <div className="rounded-lg border-[1.5px] border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-900">
                        ✅ Yük hazır — yükleme noktasına gidebilirsiniz.
                      </div>
                      <DriverShipmentActions
                        shipmentId={shipment.id}
                        targetStatus="HEADING_TO_PICKUP"
                        label="Yükleme Noktasına Gidiyorum"
                      />
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      {shipment.loadReadyAt
                        ? "Fiyat onayı bekleniyor — onaylanınca yola çıkabilirsiniz."
                        : "Yük henüz hazır değil. Müşteri yükü hazırladığında buradan yola çıkabileceksiniz."}
                    </p>
                  )
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
