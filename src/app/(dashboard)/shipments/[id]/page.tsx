import { notFound } from "next/navigation";
import { Navigation } from "lucide-react";

import {
  getDeparturePhoto,
  getOpenIncident,
  getShipment,
  getStatusHistory,
} from "@/core/shipment/shipment-service";
import { requireTenantContext } from "@/core/shared/tenant-context";
import { NotFoundError } from "@/core/shared/errors";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  customerShipmentStatusLabels,
  shipmentStatusLabels,
  statusBadgeVariant,
} from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { ShipmentStatusActions } from "@/app/(dashboard)/shipments/[id]/shipment-status-actions";
import { LoadReadyCard } from "@/app/(dashboard)/shipments/[id]/load-ready-card";
import { PickupEtaCard } from "@/app/(dashboard)/shipments/[id]/pickup-eta-card";
import { PriceApprovalCard } from "@/app/(dashboard)/shipments/[id]/price-approval-card";
import { IncidentCard } from "@/app/(dashboard)/shipments/[id]/incident-card";
import { StatusTimelineCard } from "@/app/(dashboard)/shipments/[id]/status-timeline-card";

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
  const [incident, departurePhoto, statusHistory] = await Promise.all([
    shipment.hasOpenIncident ? getOpenIncident(ctx, shipment.id) : null,
    getDeparturePhoto(shipment.id),
    getStatusHistory(shipment.id),
  ]);

  const statusLabels =
    ctx.companyType === "CUSTOMER" ? customerShipmentStatusLabels : shipmentStatusLabels;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
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

      <Card>
        <CardHeader>
          <CardTitle>Sefer Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Müşteri" value={shipment.customerCompany.name} />
          <Field
            label="Tedarikçi"
            value={shipment.supplierCompany?.name ?? "Henüz atanmadı"}
          />
          <Field label="Mesafe" value={`${shipment.distanceKm.toString()} km`} />
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

      <Card>
        <CardHeader>
          <CardTitle>Araç ve Şoför</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="Araç" value={shipment.vehicle?.plate ?? "Henüz atanmadı"} />
          <Field
            label="Şoför"
            value={shipment.driver?.fullName ?? "Henüz atanmadı"}
          />
          {departurePhoto?.photoUrl && (
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
