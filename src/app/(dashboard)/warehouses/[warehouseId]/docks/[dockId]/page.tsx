import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { NotFoundError } from "@/core/shared/errors";
import { getDock } from "@/core/warehouse/warehouse-service";
import { listReservationsForWeek } from "@/core/warehouse/dock-reservation-service";
import { addDays, buildWeekGrid, parseWeekParam, toWeekParam } from "@/lib/dock-calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBreakdownChart } from "@/components/dashboard/status-breakdown-chart";
import { dockReservationStatusLabels } from "@/lib/labels";
import { DockCalendar } from "@/app/(dashboard)/warehouses/[warehouseId]/docks/[dockId]/dock-calendar";
import { toSerializableReservation } from "@/app/(dashboard)/warehouses/[warehouseId]/docks/[dockId]/types";

export default async function DockDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ warehouseId: string; dockId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { warehouseId, dockId } = await params;
  const { week } = await searchParams;
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "SUPPLIER") {
    redirect("/dashboard");
  }

  let dock;
  try {
    dock = await getDock(ctx, dockId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const weekStart = parseWeekParam(week);
  const weekEnd = addDays(weekStart, 7);
  const reservations = (
    await listReservationsForWeek(ctx, dockId, weekStart, weekEnd)
  ).map(toSerializableReservation);

  const grid = buildWeekGrid(weekStart, dock.workingHours, dock.slotDurationMinutes);

  const statusCounts: Record<string, number> = {};
  for (const reservation of reservations) {
    statusCounts[reservation.status] = (statusCounts[reservation.status] ?? 0) + 1;
  }

  const openSlotCount = grid.cells.filter((cell) => cell.isOpen).length;
  const bookedSlotCount = reservations.filter((r) => r.status !== "CANCELLED").length;
  const occupancyPct =
    openSlotCount > 0 ? Math.round((bookedSlotCount / openSlotCount) * 100) : 0;

  const weekEndDisplay = addDays(weekStart, 6);
  const rangeLabel = `${weekStart.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  })} – ${weekEndDisplay.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{dock.warehouse.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{dock.name}</h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/warehouses">
            <ArrowLeft />
            Depolara Dön
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Haftalık Takvim</CardTitle>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`?week=${toWeekParam(addDays(weekStart, -7))}`}>
                  ← Önceki
                </Link>
              </Button>
              <span className="text-sm font-medium">{rangeLabel}</span>
              <Button asChild variant="outline" size="sm">
                <Link href={`?week=${toWeekParam(addDays(weekStart, 7))}`}>
                  Sonraki →
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DockCalendar
              warehouseId={warehouseId}
              dockId={dockId}
              supportedReservationTypes={dock.supportedReservationTypes}
              supportedVehicleTypes={dock.supportedVehicleTypes}
              grid={grid}
              reservations={reservations}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Doluluk Özeti</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Bu Hafta Doluluk</span>
              <span className="font-semibold">%{occupancyPct}</span>
            </div>
            <StatusBreakdownChart
              counts={statusCounts}
              labels={dockReservationStatusLabels}
              unitLabel="Rezervasyon"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
