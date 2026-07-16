import { notFound } from "next/navigation";
import { MapPinned, Navigation, Package, Truck, User } from "lucide-react";

import {
  getDeparturePhoto,
  getOpenIncident,
  getShipment,
  getStatusHistory,
} from "@/core/shipment/shipment-service";
import { getActiveReservationForShipment } from "@/core/warehouse/dock-reservation-service";
import { listWarehouses } from "@/core/warehouse/warehouse-service";
import { requireTenantContext } from "@/core/shared/tenant-context";
import { NotFoundError } from "@/core/shared/errors";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  customerShipmentStatusLabels,
  shipmentStatusLabels,
  statusBadgeVariant,
  vehicleBedTypeLabels,
  vehicleTypeLabels,
} from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { ShipmentStatusActions } from "@/app/(dashboard)/shipments/[id]/shipment-status-actions";
import { LoadReadyCard } from "@/app/(dashboard)/shipments/[id]/load-ready-card";
import { PickupEtaCard } from "@/app/(dashboard)/shipments/[id]/pickup-eta-card";
import { PriceApprovalCard } from "@/app/(dashboard)/shipments/[id]/price-approval-card";
import { IncidentCard } from "@/app/(dashboard)/shipments/[id]/incident-card";
import { StatusTimelineCard } from "@/app/(dashboard)/shipments/[id]/status-timeline-card";
import { DockReservationCard } from "@/app/(dashboard)/shipments/[id]/dock-reservation-card";
import { DockReservationType } from "@/generated/prisma/enums";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

/** Read-only for both roles — there is no edit affordance for this data anywhere. */
function NavigationLink({ url }: { url: string | null }) {
  if (!url) return <>Paylaşılmadı</>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary inline-flex items-center gap-1 underline underline-offset-2"
    >
      <Navigation className="size-3.5" />
      Navigasyonu Başlat
    </a>
  );
}

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireTenantContext();

  let shipment;
  try {
    shipment = await getShipment(ctx, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  // Conditional on the denormalized flag — avoids a pointless query in the
  // common (no open incident) case. getDeparturePhoto always runs; it's a
  // single indexed lookup and there's no equivalent cheap flag for it.
  // getActiveReservationForShipment is read by BOTH sides (customer manages
  // it, supplier only ever sees it read-only — see the schema comment above
  // Warehouse/DockReservation); listWarehouses is CUSTOMER-only (used to
  // populate the "Rampa Rezervasyonu Yap" dock picker) so it's skipped
  // entirely on the supplier's view of this same page.
  const [incident, departurePhoto, statusHistory, dockReservation, warehouses] =
    await Promise.all([
      shipment.hasOpenIncident ? getOpenIncident(ctx, shipment.id) : null,
      getDeparturePhoto(shipment.id),
      getStatusHistory(shipment.id),
      getActiveReservationForShipment(ctx, shipment.id),
      ctx.companyType === "CUSTOMER" ? listWarehouses(ctx) : Promise.resolve([]),
    ]);

  const assignableDocks = warehouses.flatMap((warehouse) =>
    warehouse.docks
      .filter((dock) => dock.supportedReservationTypes.includes(DockReservationType.LOADING))
      .map((dock) => ({
        id: dock.id,
        name: dock.name,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        slotDurationMinutes: dock.slotDurationMinutes,
        workingHours: dock.workingHours,
      }))
  );

  const statusLabels =
    ctx.companyType === "CUSTOMER" ? customerShipmentStatusLabels : shipmentStatusLabels;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground font-mono text-xs">
            Sevkiyat No: {shipment.trackingNumber}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            {shipment.originAddress} → {shipment.destinationAddress}
          </h1>
          <p className="text-muted-foreground text-sm">
            Oluşturulma: {formatDateTime(shipment.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {shipment.hasOpenIncident && (
            <Badge variant="destructive" className="text-sm">
              Arıza
            </Badge>
          )}
          <Badge
            variant={statusBadgeVariant[shipment.status]}
            className="text-sm"
            data-testid="shipment-status-badge"
          >
            {statusLabels[shipment.status]}
          </Badge>
        </div>
      </div>

      {ctx.companyType === "SUPPLIER" && (
        <ShipmentStatusActions shipmentId={shipment.id} status={shipment.status} />
      )}

      <StatusTimelineCard
        status={shipment.status}
        createdAt={shipment.createdAt}
        companyType={ctx.companyType}
        history={statusHistory}
      />

      <IncidentCard
        shipmentId={shipment.id}
        companyType={ctx.companyType}
        incident={incident}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPinned className="text-muted-foreground size-4" />
              Rota Bilgisi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative flex flex-col gap-5 pl-1">
              <div
                className="absolute top-2 bottom-2 left-[5px] z-0 w-px"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, var(--color-border) 0 4px, transparent 4px 8px)",
                }}
              />
              <div className="relative flex gap-3">
                <span className="bg-primary relative z-10 mt-1 size-2.5 shrink-0 rounded-full" />
                <div>
                  <p className="text-muted-foreground text-xs">Çıkış Noktası</p>
                  <p className="text-sm font-medium">{shipment.originAddress}</p>
                </div>
              </div>
              <div className="relative flex gap-3">
                <span className="bg-accent-blue relative z-10 mt-1 size-2.5 shrink-0 rounded-full" />
                <div>
                  <p className="text-muted-foreground text-xs">Varış Noktası</p>
                  <p className="text-sm font-medium">
                    {shipment.destinationAddress}
                  </p>
                </div>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Toplam Mesafe</span>
              <span className="font-semibold">
                ~{shipment.distanceKm.toString()} km
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Müşteri</span>
              <span className="font-medium">{shipment.customerCompany.name}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tedarikçi</span>
              <span className="font-medium">
                {shipment.supplierCompany?.name ?? "Henüz atanmadı"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="text-muted-foreground size-4" />
              Yük Detayları
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Tonaj" value={`${shipment.tonnage.toString()} ton`} />
            <Field
              label="Belge Takip Numarası"
              value={shipment.documentTrackingNumber ?? "Girilmedi"}
            />
            {shipment.cargoDescription && (
              <div className="col-span-full">
                <Field label="Yük Açıklaması" value={shipment.cargoDescription} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(shipment.originMapsUrl || shipment.destinationMapsUrl) && (
        <Card>
          <CardHeader>
            <CardTitle>Kapı Rezervasyonu</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field
              label="Yükleme Noktası"
              value={<NavigationLink url={shipment.originMapsUrl} />}
            />
            <Field
              label="Teslimat Noktası"
              value={<NavigationLink url={shipment.destinationMapsUrl} />}
            />
          </CardContent>
        </Card>
      )}

      <DockReservationCard
        status={shipment.status}
        companyType={ctx.companyType}
        shipmentId={shipment.id}
        assignableDocks={assignableDocks}
        vehicle={
          shipment.vehicle
            ? { plate: shipment.vehicle.plate, vehicleType: shipment.vehicle.vehicleType }
            : null
        }
        driver={
          shipment.driver
            ? { fullName: shipment.driver.fullName, phone: shipment.driver.phone }
            : null
        }
        reservation={
          dockReservation
            ? {
                warehouseId: dockReservation.dock.warehouse.id,
                warehouseName: dockReservation.dock.warehouse.name,
                dockId: dockReservation.dock.id,
                dockName: dockReservation.dock.name,
                startAt: dockReservation.startAt,
                status: dockReservation.status,
              }
            : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="text-muted-foreground size-4" />
            Araç ve Şoför
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Truck className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {shipment.vehicle?.plate ?? "Henüz atanmadı"}
              </p>
              {shipment.vehicle && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[11px]">
                    {vehicleTypeLabels[shipment.vehicle.vehicleType]}
                  </Badge>
                  <Badge variant="outline" className="text-[11px]">
                    {vehicleBedTypeLabels[shipment.vehicle.bedType]}
                  </Badge>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <span className="bg-accent-blue/10 text-accent-blue flex size-10 shrink-0 items-center justify-center rounded-full">
              <User className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {shipment.driver?.fullName ?? "Henüz atanmadı"}
              </p>
              {shipment.driver && (
                <p className="text-muted-foreground truncate text-xs">
                  {shipment.driver.phone}
                  {shipment.driver.experienceYears != null &&
                    ` • ${shipment.driver.experienceYears} yıl deneyim`}
                </p>
              )}
            </div>
          </div>
          {departurePhoto?.photoUrl && (
            <div className="col-span-full">
              <Field
                label="Yükleme Fotoğrafı"
                value={
                  <a
                    href={`/api/uploads/${departurePhoto.photoUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Fotoğrafı Görüntüle
                  </a>
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <PriceApprovalCard
        shipmentId={shipment.id}
        companyType={ctx.companyType}
        agreedPrice={shipment.agreedPrice ? shipment.agreedPrice.toNumber() : null}
        priceProposedBy={shipment.priceProposedBy}
        priceApprovedAt={shipment.priceApprovedAt}
        priceRejectedAt={shipment.priceRejectedAt}
      />

      <PickupEtaCard
        shipmentId={shipment.id}
        status={shipment.status}
        companyType={ctx.companyType}
        estimatedPickupArrivalAt={shipment.estimatedPickupArrivalAt}
      />

      <LoadReadyCard
        shipmentId={shipment.id}
        status={shipment.status}
        companyType={ctx.companyType}
        originAddress={shipment.originAddress}
        destinationAddress={shipment.destinationAddress}
        pickupGateInfo={shipment.pickupGateInfo}
        pickupMapsUrl={shipment.pickupMapsUrl}
        loadReadyAt={shipment.loadReadyAt}
      />

      <Separator />
      <p className="text-muted-foreground text-xs">
        Son güncelleme: {formatDateTime(shipment.updatedAt)}
      </p>
    </div>
  );
}
