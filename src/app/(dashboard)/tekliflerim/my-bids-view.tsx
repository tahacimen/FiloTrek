"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileSpreadsheet, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  shipmentBidStatusBadgeVariant,
  shipmentBidStatusLabels,
  shipmentStatusLabels,
} from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import {
  bidMatchesFilters,
  EMPTY_MY_BID_FILTERS,
  myBidFiltersToParams,
  summarizeBids,
  type MyBidFilters,
} from "@/lib/bid-filter";
import type { ShipmentBidStatus, ShipmentStatus } from "@/generated/prisma/enums";

export type MyBidRow = {
  id: string;
  createdAt: Date;
  status: ShipmentBidStatus;
  price: number;
  shipment: {
    id: string;
    originAddress: string;
    destinationAddress: string;
    tonnage: string;
    status: ShipmentStatus;
    customerCompany: { name: string } | null;
    winnerName: string | null;
  };
};

const ALL = "__all__";

const priceFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 2,
});

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "destructive" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "warning"
          ? "text-amber-600"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className={`text-2xl font-semibold ${toneClass}`}>{value}</span>
      </CardContent>
    </Card>
  );
}

export function MyBidsView({ bids }: { bids: MyBidRow[] }) {
  const [filters, setFilters] = useState<MyBidFilters>(EMPTY_MY_BID_FILTERS);

  const filtered = useMemo(
    () => bids.filter((b) => bidMatchesFilters(b, filters)),
    [bids, filters]
  );
  const summary = useMemo(() => summarizeBids(filtered), [filtered]);

  const hasActiveFilters =
    filters.q !== "" ||
    filters.status !== "" ||
    filters.from !== "" ||
    filters.to !== "";

  const exportHref = `/api/my-bids-export?${myBidFiltersToParams(
    filters
  ).toString()}`;

  function set<K extends keyof MyBidFilters>(key: K, value: MyBidFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Verilen Teklif" value={summary.total} />
        <StatCard label="Kazanılan" value={summary.won} tone="success" />
        <StatCard label="Kaybedilen" value={summary.lost} tone="destructive" />
        <StatCard label="Bekleyen" value={summary.pending} tone="warning" />
        <StatCard label="Kazanma Oranı" value={`%${summary.winRate}`} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <Label htmlFor="bid-q" className="text-xs">
              Ara
            </Label>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                id="bid-q"
                value={filters.q}
                onChange={(e) => set("q", e.target.value)}
                placeholder="Güzergah, müşteri…"
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Durum</Label>
            <Select
              value={filters.status === "" ? ALL : filters.status}
              onValueChange={(v) =>
                set("status", v === ALL ? "" : (v as ShipmentBidStatus))
              }
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tümü</SelectItem>
                {(
                  Object.keys(shipmentBidStatusLabels) as ShipmentBidStatus[]
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    {shipmentBidStatusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bid-from" className="text-xs">
              Başlangıç
            </Label>
            <Input
              id="bid-from"
              type="date"
              value={filters.from}
              onChange={(e) => set("from", e.target.value)}
              className="w-[160px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bid-to" className="text-xs">
              Bitiş
            </Label>
            <Input
              id="bid-to"
              type="date"
              value={filters.to}
              onChange={(e) => set("to", e.target.value)}
              className="w-[160px]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {filtered.length} / {bids.length} teklif
            </span>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1"
                onClick={() => setFilters(EMPTY_MY_BID_FILTERS)}
              >
                <X />
                Filtreleri Temizle
              </Button>
            )}
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={exportHref}>
              <FileSpreadsheet />
              Excel İndir
            </a>
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {hasActiveFilters
            ? "Filtreye uygun teklif bulunmuyor."
            : "Henüz pazaryerinde teklif vermediniz."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead>Güzergah</TableHead>
              <TableHead>Müşteri</TableHead>
              <TableHead>Tonaj</TableHead>
              <TableHead>Teklifiniz</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Sefer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((bid) => (
              <TableRow key={bid.id}>
                <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                  {formatDateTime(bid.createdAt)}
                </TableCell>
                <TableCell>
                  {bid.shipment.originAddress} → {bid.shipment.destinationAddress}
                </TableCell>
                <TableCell>{bid.shipment.customerCompany?.name ?? "—"}</TableCell>
                <TableCell>{bid.shipment.tonnage} ton</TableCell>
                <TableCell className="whitespace-nowrap">
                  {priceFormatter.format(bid.price)} ₺
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <Badge variant={shipmentBidStatusBadgeVariant[bid.status]}>
                      {shipmentBidStatusLabels[bid.status]}
                    </Badge>
                    {bid.status === "REJECTED" && bid.shipment.winnerName && (
                      <span className="text-muted-foreground text-xs">
                        Kazanan: {bid.shipment.winnerName}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-muted-foreground text-xs">
                      {shipmentStatusLabels[bid.shipment.status]}
                    </span>
                    {bid.status === "ACCEPTED" && (
                      <Link
                        href={`/shipments/${bid.shipment.id}`}
                        className="text-primary text-xs hover:underline"
                      >
                        Seferi Gör
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
