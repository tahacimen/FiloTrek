import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { getReservationReport } from "@/core/warehouse/dock-reservation-report-service";
import { addDays, toWeekParam } from "@/lib/dock-calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBreakdownChart } from "@/components/dashboard/status-breakdown-chart";
import { TrendChart } from "@/components/dashboard/trend-chart";
import {
  dockReservationStatusLabels,
  dockReservationTypeLabels,
} from "@/lib/labels";

const DEFAULT_RANGE_DAYS = 30;

/** "2026-08-03" -> local midnight Date, no week-snapping (unlike parseWeekParam, which is for the dock calendar's Monday-aligned grid). */
function parseDateParam(param: string | undefined, fallback: Date): Date {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const [y, m, d] = param.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return fallback;
}

export default async function WarehouseReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "SUPPLIER") {
    redirect("/dashboard");
  }

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const defaultFrom = addDays(todayMidnight, -(DEFAULT_RANGE_DAYS - 1));

  const fromDate = parseDateParam(from, defaultFrom);
  const toDate = parseDateParam(to, todayMidnight);
  // Repository filters startAt with [rangeStart, rangeEnd) — the "to" input
  // is an inclusive end date from the user's perspective, so the exclusive
  // upper bound is the day AFTER it.
  const rangeEnd = addDays(toDate, 1);

  const report = await getReservationReport(ctx, fromDate, rangeEnd);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Depo & Rampa Raporu</h1>
          <p className="text-muted-foreground text-sm">
            Tüm depolarınız ve rampalarınız için rezervasyon özeti.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/warehouses">
            <ArrowLeft />
            Depolara Dön
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="from">Başlangıç</Label>
              <Input id="from" type="date" name="from" defaultValue={toWeekParam(fromDate)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="to">Bitiş</Label>
              <Input id="to" type="date" name="to" defaultValue={toWeekParam(toDate)} />
            </div>
            <Button type="submit" size="sm">
              Uygula
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="flex flex-col gap-0 p-0 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1 border-b px-5 py-4 sm:border-r sm:border-b-0">
          <span className="text-muted-foreground text-xs">Toplam Rezervasyon</span>
          <span className="text-2xl font-extrabold tracking-tight">
            {report.totalReservations}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1 border-b px-5 py-4 sm:border-r sm:border-b-0">
          <span className="text-muted-foreground text-xs">Tamamlanan</span>
          <span className="text-2xl font-extrabold tracking-tight">
            {report.statusCounts.COMPLETED}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1 border-b px-5 py-4 sm:border-r sm:border-b-0">
          <span className="text-muted-foreground text-xs">İptal Edilen</span>
          <span className="text-2xl font-extrabold tracking-tight">
            {report.statusCounts.CANCELLED}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1 px-5 py-4">
          <span className="text-muted-foreground text-xs">Ortalama Doluluk</span>
          <span className="text-2xl font-extrabold tracking-tight">
            %{report.overallOccupancyPct}
          </span>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Durum Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdownChart
              counts={report.statusCounts}
              labels={dockReservationStatusLabels}
              unitLabel="Rezervasyon"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Yükleme / Boşaltma Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdownChart
              counts={report.typeCounts}
              labels={dockReservationTypeLabels}
              unitLabel="Rezervasyon"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Günlük Rezervasyon Trendi</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={report.dailyTrend} seriesLabel="Oluşturulan Rezervasyon" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rampa Bazında Doluluk</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Depo</TableHead>
                <TableHead>Rampa</TableHead>
                <TableHead className="text-right">Rezervasyon</TableHead>
                <TableHead className="text-right">Doluluk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.perDock.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                    Henüz rampa tanımlanmadı.
                  </TableCell>
                </TableRow>
              )}
              {report.perDock.map((row) => (
                <TableRow key={row.dockId}>
                  <TableCell>{row.warehouseName}</TableCell>
                  <TableCell>{row.dockName}</TableCell>
                  <TableCell className="text-right">{row.reservationCount}</TableCell>
                  <TableCell className="text-right">%{row.occupancyPct}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
