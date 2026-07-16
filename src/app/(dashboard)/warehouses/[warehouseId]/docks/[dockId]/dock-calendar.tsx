"use client";

import { Fragment, useState } from "react";
import { Link2, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  dockReservationStatusBadgeVariant,
  dockReservationTypeLabels,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { WeekDay, WeekGridCell } from "@/lib/dock-calendar";
import type {
  DockReservationType,
  VehicleType,
} from "@/generated/prisma/client";
import { ReservationFormDialog } from "@/app/(dashboard)/warehouses/[warehouseId]/docks/[dockId]/reservation-form-dialog";
import { ReservationDetailDialog } from "@/app/(dashboard)/warehouses/[warehouseId]/docks/[dockId]/reservation-detail-dialog";
import type {
  AssignableShipmentOption,
  SerializableReservation,
} from "@/app/(dashboard)/warehouses/[warehouseId]/docks/[dockId]/types";

export function DockCalendar({
  warehouseId,
  dockId,
  supportedReservationTypes,
  supportedVehicleTypes,
  assignableShipments,
  grid,
  reservations,
}: {
  warehouseId: string;
  dockId: string;
  supportedReservationTypes: DockReservationType[];
  supportedVehicleTypes: VehicleType[];
  assignableShipments: AssignableShipmentOption[];
  grid: { days: WeekDay[]; timeRows: string[]; cells: WeekGridCell[] };
  reservations: SerializableReservation[];
}) {
  const [selectedCell, setSelectedCell] = useState<WeekGridCell | null>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<SerializableReservation | null>(null);

  const reservationByStart = new Map(
    reservations.map((r) => [r.startAt.getTime(), r])
  );
  const cellsByKey = new Map(
    grid.cells.map((c) => [`${c.dayIndex}-${c.timeLabel}`, c])
  );

  if (grid.timeRows.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        Bu rampa için henüz çalışma saati tanımlanmadı. Rampayı düzenleyerek
        çalışma saatlerini ayarlayın.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-px bg-border text-xs"
        style={{ gridTemplateColumns: "70px repeat(7, minmax(100px, 1fr))" }}
      >
        <div className="bg-card" />
        {grid.days.map((day) => (
          <div key={day.dayOfWeek} className="bg-card p-2 text-center font-medium">
            {day.label}
            <div className="text-muted-foreground font-normal">
              {day.date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
            </div>
          </div>
        ))}
        {grid.timeRows.map((timeLabel) => (
          <Fragment key={timeLabel}>
            <div className="bg-card p-2 text-right text-muted-foreground">
              {timeLabel}
            </div>
            {grid.days.map((_day, dayIndex) => {
              const cell = cellsByKey.get(`${dayIndex}-${timeLabel}`);
              if (!cell || !cell.isOpen) {
                return <div key={dayIndex} className="bg-muted/30" />;
              }
              const reservation = reservationByStart.get(cell.start.getTime());
              if (reservation) {
                const isCancelled = reservation.status === "CANCELLED";
                return (
                  <button
                    key={dayIndex}
                    type="button"
                    onClick={() => setSelectedReservation(reservation)}
                    className={cn(
                      "flex min-h-14 flex-col items-start gap-0.5 p-1.5 text-left transition-colors",
                      isCancelled
                        ? "bg-card text-muted-foreground line-through"
                        : "bg-primary/10 hover:bg-primary/20"
                    )}
                  >
                    <Badge
                      variant={dockReservationStatusBadgeVariant[reservation.status]}
                      className="text-[10px]"
                    >
                      {dockReservationTypeLabels[reservation.reservationType]}
                    </Badge>
                    <span className="flex items-center gap-1 truncate font-medium">
                      {reservation.shipmentId && (
                        <Link2 className="size-3 shrink-0" aria-label="Sefere bağlı" />
                      )}
                      {reservation.plate}
                    </span>
                  </button>
                );
              }
              return (
                <button
                  key={dayIndex}
                  type="button"
                  onClick={() => setSelectedCell(cell)}
                  className="text-muted-foreground/40 hover:bg-accent hover:text-muted-foreground flex min-h-14 items-center justify-center bg-card transition-colors"
                >
                  <Plus className="size-3.5" />
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>

      {selectedCell && (
        <ReservationFormDialog
          warehouseId={warehouseId}
          dockId={dockId}
          cell={selectedCell}
          supportedReservationTypes={supportedReservationTypes}
          supportedVehicleTypes={supportedVehicleTypes}
          assignableShipments={assignableShipments}
          onClose={() => setSelectedCell(null)}
        />
      )}
      {selectedReservation && (
        <ReservationDetailDialog
          warehouseId={warehouseId}
          dockId={dockId}
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
        />
      )}
    </div>
  );
}
