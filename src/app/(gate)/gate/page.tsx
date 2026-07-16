import { requireGateGuardContext } from "@/core/shared/gate-guard-context";
import { listActiveShipmentsForGateGuard } from "@/core/gate-guard/gate-event-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { GateEventActions } from "@/app/(gate)/gate/gate-event-actions";
import { DockReservationGateActions } from "@/app/(gate)/gate/dock-reservation-gate-actions";
import { GateEventType } from "@/generated/prisma/enums";
import type { DockReservationStatus } from "@/generated/prisma/enums";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function GateShipmentCard({
  shipment,
}: {
  shipment: {
    id: string;
    originAddress: string;
    destinationAddress: string;
    vehicle: { plate: string } | null;
    driver: { fullName: string } | null;
    gateEvents: { eventType: GateEventType; occurredAt: Date }[];
    dockReservations: {
      id: string;
      status: DockReservationStatus;
      dock: { name: string; warehouse: { name: string } };
    }[];
  };
}) {
  const latestEvent = shipment.gateEvents[0] ?? null;
  const isInside = latestEvent?.eventType === GateEventType.VEHICLE_ENTERED;
  const isDone = latestEvent?.eventType === GateEventType.VEHICLE_EXITED;

  const statusLabel = isDone ? "Tamamlandı" : isInside ? "Çıkış Bekleniyor" : "Dışarıda";
  const statusVariant = isDone ? "success" : isInside ? "warning" : "outline";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {shipment.originAddress} → {shipment.destinationAddress}
          </CardTitle>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Araç" value={shipment.vehicle?.plate ?? "Henüz atanmadı"} />
          <Field
            label="Şoför"
            value={shipment.driver?.fullName ?? "Henüz atanmadı"}
          />
          {latestEvent && (
            <div className="col-span-full">
              <Field
                label={
                  latestEvent.eventType === GateEventType.VEHICLE_ENTERED
                    ? "Giriş Saati"
                    : "Çıkış Saati"
                }
                value={formatDateTime(latestEvent.occurredAt)}
              />
            </div>
          )}
        </div>

        <GateEventActions
          shipmentId={shipment.id}
          isInside={isInside}
          isDone={isDone}
        />

        {shipment.dockReservations[0] && (
          <DockReservationGateActions
            reservationId={shipment.dockReservations[0].id}
            status={shipment.dockReservations[0].status}
            warehouseName={shipment.dockReservations[0].dock.warehouse.name}
            dockName={shipment.dockReservations[0].dock.name}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default async function GatePage() {
  const gateGuardCtx = await requireGateGuardContext();
  const shipments = await listActiveShipmentsForGateGuard(gateGuardCtx);

  // Once a vehicle's exit is logged, that shipment is done from the gate
  // guard's own point of view — it moves out of the list that needs
  // attention into its own read-only section, rather than staying mixed
  // in (see logGateEvent in gate-event-service.ts for why exit is terminal).
  const pending = shipments.filter(
    (s) => s.gateEvents[0]?.eventType !== GateEventType.VEHICLE_EXITED
  );
  const completed = shipments.filter(
    (s) => s.gateEvents[0]?.eventType === GateEventType.VEHICLE_EXITED
  );

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nizamiye</h1>
        <p className="text-muted-foreground text-sm">
          Aktif seferlerdeki araçların giriş/çıkış kayıtları.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Aktif Takip</h2>
        {pending.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              Şu anda takip edilecek aktif bir sefer bulunmuyor.
            </CardContent>
          </Card>
        ) : (
          pending.map((shipment) => (
            <GateShipmentCard key={shipment.id} shipment={shipment} />
          ))
        )}
      </div>

      {completed.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Tamamlanan Kayıtlar
          </h2>
          {completed.map((shipment) => (
            <GateShipmentCard key={shipment.id} shipment={shipment} />
          ))}
        </div>
      )}
    </>
  );
}
