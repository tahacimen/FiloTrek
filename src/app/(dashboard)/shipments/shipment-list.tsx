"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, Search, X } from "lucide-react";

import {
  ShipmentTable,
  type ShipmentRow,
} from "@/app/(dashboard)/shipments/shipment-table";
import { Button } from "@/components/ui/button";
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
  customerShipmentStatusLabels,
  paymentStatusLabels,
  shipmentStatusLabels,
} from "@/lib/labels";
import {
  EMPTY_SHIPMENT_FILTERS,
  shipmentFiltersToParams,
  shipmentMatchesFilters,
  type ShipmentFilters,
} from "@/lib/shipment-filter";
import type { PaymentStatus, ShipmentStatus } from "@/generated/prisma/enums";

// S1: client-side filter bar over the already-fetched Seferler list, plus an
// Excel export of exactly the filtered rows (the export route re-applies the
// same predicate server-side from these filters).
const ALL = "__all__";

export function ShipmentList({
  shipments,
  viewerCompanyType,
}: {
  shipments: ShipmentRow[];
  viewerCompanyType: "SUPPLIER" | "CUSTOMER";
}) {
  const [filters, setFilters] = useState<ShipmentFilters>(
    EMPTY_SHIPMENT_FILTERS
  );

  const statusLabels =
    viewerCompanyType === "CUSTOMER"
      ? customerShipmentStatusLabels
      : shipmentStatusLabels;

  const filtered = useMemo(
    () => shipments.filter((s) => shipmentMatchesFilters(s, filters)),
    [shipments, filters]
  );

  const hasActiveFilters =
    filters.q !== "" ||
    filters.status !== "" ||
    filters.payment !== "" ||
    filters.from !== "" ||
    filters.to !== "" ||
    filters.marketplace !== "";

  const exportHref = `/api/shipments-export?${shipmentFiltersToParams(
    filters
  ).toString()}`;

  function set<K extends keyof ShipmentFilters>(
    key: K,
    value: ShipmentFilters[K]
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <Label htmlFor="shipment-q" className="text-xs">
              Ara
            </Label>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                id="shipment-q"
                value={filters.q}
                onChange={(e) => set("q", e.target.value)}
                placeholder="Takip no, güzergah, plaka, şoför, firma…"
                className="pl-8"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Durum</Label>
            <Select
              value={filters.status === "" ? ALL : filters.status}
              onValueChange={(v) =>
                set("status", v === ALL ? "" : (v as ShipmentStatus))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tümü</SelectItem>
                {(Object.keys(statusLabels) as ShipmentStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Ödeme</Label>
            <Select
              value={filters.payment === "" ? ALL : filters.payment}
              onValueChange={(v) =>
                set("payment", v === ALL ? "" : (v as PaymentStatus))
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tümü</SelectItem>
                {(Object.keys(paymentStatusLabels) as PaymentStatus[]).map(
                  (p) => (
                    <SelectItem key={p} value={p}>
                      {paymentStatusLabels[p]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Pazaryeri</Label>
            <Select
              value={filters.marketplace === "" ? ALL : filters.marketplace}
              onValueChange={(v) =>
                set(
                  "marketplace",
                  v === ALL ? "" : (v as "yes" | "no")
                )
              }
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tümü</SelectItem>
                <SelectItem value="yes">Evet</SelectItem>
                <SelectItem value="no">Hayır</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shipment-from" className="text-xs">
              Başlangıç
            </Label>
            <Input
              id="shipment-from"
              type="date"
              value={filters.from}
              onChange={(e) => set("from", e.target.value)}
              className="w-[160px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shipment-to" className="text-xs">
              Bitiş
            </Label>
            <Input
              id="shipment-to"
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
              {filtered.length} / {shipments.length} sefer
            </span>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1"
                onClick={() => setFilters(EMPTY_SHIPMENT_FILTERS)}
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

      <ShipmentTable
        shipments={filtered}
        viewerCompanyType={viewerCompanyType}
        emptyMessage={
          hasActiveFilters
            ? "Filtreye uygun sefer bulunmuyor."
            : "Henüz sefer bulunmuyor."
        }
      />
    </div>
  );
}
