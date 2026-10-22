import Link from "next/link";
import { PackageSearch, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  customerShipmentStatusLabels,
  statusBadgeVariant,
} from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { trackShipmentByToken } from "@/core/shipment/public-tracking";
import { StatusTimelineCard } from "@/app/(dashboard)/shipments/[id]/status-timeline-card";
import { ShipmentLiveMap } from "@/components/shipment-live-map-loader";

// Public, unauthenticated live-tracking view reached by an unguessable token
// (N5). Mirrors /track's safe projection but needs no search box — the token
// resolves straight to one shipment. force-dynamic for the per-request CSP
// nonce, same as /track.
export const dynamic = "force-dynamic";

export default async function LiveTrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await trackShipmentByToken(token);

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f3]">
      <header className="border-b border-[#ece9e3] bg-white">
        <div className="mx-auto flex h-[68px] max-w-[900px] items-center justify-between px-5">
          <Link href="/">
            <Logo className="h-7 w-auto" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-[#f5b301] px-4 py-2 text-sm font-semibold text-[#1a1a1a] transition hover:bg-[#e0a400]"
          >
            Giriş Yap
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[900px] flex-1 px-5 py-10">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex size-14 items-center justify-center rounded-2xl bg-[#1e1e1e] text-[#f5b301]">
            <PackageSearch className="size-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Canlı Sevkiyat Takibi
          </h1>
        </div>

        {!result ? (
          <Card className="mx-auto mt-4 max-w-[520px] border-destructive/30">
            <CardContent className="text-center">
              <p className="font-semibold">Takip bağlantısı geçersiz</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Bu canlı takip bağlantısı geçersiz veya artık aktif değil.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <p className="text-muted-foreground font-mono text-xs">
                    Sevkiyat No: {result.trackingNumber}
                  </p>
                  <CardTitle className="mt-1 text-xl">
                    {result.originAddress} → {result.destinationAddress}
                  </CardTitle>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Oluşturulma: {formatDateTime(result.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge variant={statusBadgeVariant[result.status]} className="text-sm">
                    {customerShipmentStatusLabels[result.status]}
                  </Badge>
                  {result.hasOpenIncident && (
                    <Badge variant="destructive">Arıza bildirildi</Badge>
                  )}
                </div>
              </CardHeader>
            </Card>

            <StatusTimelineCard
              status={result.status}
              createdAt={result.createdAt}
              companyType="CUSTOMER"
              history={result.history}
            />

            {result.liveLocation && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Canlı Konum</CardTitle>
                </CardHeader>
                <CardContent>
                  <ShipmentLiveMap
                    lat={result.liveLocation.lat}
                    lng={result.liveLocation.lng}
                    label={`${result.originAddress} → ${result.destinationAddress}`}
                  />
                  <p className="text-muted-foreground mt-2 text-xs">
                    Son güncelleme: {formatDateTime(result.liveLocation.at)}
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs">
              <ShieldCheck className="size-3.5" />
              Fiyat ve ticari detaylar gizlidir; yalnızca sevkiyat durumu
              gösterilir.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
