"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { BidCountdown } from "@/components/bid-countdown";
import {
  marketplaceRequestStatus,
  marketplaceRequestStatusBadge,
  marketplaceRequestStatusLabels,
  type MarketplaceRequestStatus,
} from "@/lib/bid";

export type RequestRow = {
  id: string;
  trackingNumber: number;
  originAddress: string;
  destinationAddress: string;
  tonnage: string;
  createdAt: Date;
  biddingDeadline: string | null;
  supplierCompanyId: string | null;
  awardedSupplierName: string | null;
  bidCount: number;
  lowestBid: number | null;
};

const ALL = "__all__";
const priceFmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600"
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

export function RequestProcessView({ rows }: { rows: RequestRow[] }) {
  const [filter, setFilter] = useState<MarketplaceRequestStatus | "">("");

  const withStatus = useMemo(
    () =>
      rows.map((r) => ({
        row: r,
        status: marketplaceRequestStatus({
          supplierCompanyId: r.supplierCompanyId,
          biddingDeadline: r.biddingDeadline
            ? new Date(r.biddingDeadline)
            : null,
          bidCount: r.bidCount,
        }),
      })),
    [rows]
  );

  const counts = useMemo(() => {
    const c = { AWARDED: 0, COLLECTING: 0, WAITING: 0, CLOSED: 0 };
    for (const { status } of withStatus) c[status] += 1;
    return c;
  }, [withStatus]);

  const filtered = useMemo(
    () => (filter ? withStatus.filter((x) => x.status === filter) : withStatus),
    [withStatus, filter]
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Toplam Talep" value={rows.length} />
        <StatCard
          label="Teklif Toplanıyor"
          value={counts.COLLECTING}
        />
        <StatCard label="Teklif Bekleniyor" value={counts.WAITING} tone="warning" />
        <StatCard label="Karara Bağlandı" value={counts.AWARDED} tone="success" />
        <StatCard label="Süre Doldu" value={counts.CLOSED} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm">
          {filtered.length} / {rows.length} talep
        </span>
        <Select
          value={filter === "" ? ALL : filter}
          onValueChange={(v) =>
            setFilter(v === ALL ? "" : (v as MarketplaceRequestStatus))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm durumlar</SelectItem>
            {(
              Object.keys(
                marketplaceRequestStatusLabels
              ) as MarketplaceRequestStatus[]
            ).map((s) => (
              <SelectItem key={s} value={s}>
                {marketplaceRequestStatusLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {rows.length === 0
            ? "Henüz pazara açtığınız bir talep yok."
            : "Bu duruma uygun talep yok."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Takip No</TableHead>
              <TableHead>Güzergah</TableHead>
              <TableHead>Tonaj</TableHead>
              <TableHead>Teklif</TableHead>
              <TableHead>En Düşük</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Sonuç</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(({ row, status }) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground text-xs">
                  #{row.trackingNumber}
                </TableCell>
                <TableCell>
                  {row.originAddress} → {row.destinationAddress}
                </TableCell>
                <TableCell>{row.tonnage} ton</TableCell>
                <TableCell>{row.bidCount}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.lowestBid != null
                    ? `${priceFmt.format(row.lowestBid)} ₺`
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={marketplaceRequestStatusBadge[status]}>
                    {marketplaceRequestStatusLabels[status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {status === "AWARDED" && row.awardedSupplierName ? (
                    <span className="text-emerald-700">
                      {row.awardedSupplierName}
                    </span>
                  ) : status === "COLLECTING" && row.biddingDeadline ? (
                    <BidCountdown
                      deadline={new Date(row.biddingDeadline).toISOString()}
                    />
                  ) : status === "WAITING" ? (
                    <span className="text-muted-foreground">
                      Teklif bekleniyor
                    </span>
                  ) : status === "CLOSED" ? (
                    <span className="text-muted-foreground">
                      {row.bidCount > 0
                        ? "Karar verilmedi"
                        : "Teklif gelmedi"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm" className="h-auto px-2 py-1">
                    <Link href={`/shipments/${row.id}`}>Detay</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
