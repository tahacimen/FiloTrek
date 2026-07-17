import Link from "next/link";
import { ArrowRight, PackageSearch, Search, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  customerShipmentStatusLabels,
  statusBadgeVariant,
} from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import {
  parseTrackingNumber,
  trackShipmentByNumber,
} from "@/core/shipment/public-tracking";
import { StatusTimelineCard } from "@/app/(dashboard)/shipments/[id]/status-timeline-card";
import { ShipmentLiveMap } from "@/components/shipment-live-map-loader";

// The strict CSP in proxy.ts stamps a per-request nonce; this public page
// must render per request so Next can tag its scripts with that nonce
// (same reasoning as the landing page).
export const dynamic = "force-dynamic";

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ no?: string }>;
}) {
  const { no } = await searchParams;
  const trackingNumber = parseTrackingNumber(no);
  const result = trackingNumber
    ? await trackShipmentByNumber(trackingNumber)
    : null;
  const searched = no != null && no.trim() !== "";

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
            Sevkiyat Takibi
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            8 haneli sevkiyat numaranızı girerek sevkiyatınızın güncel durumunu
            görün. Giriş yapmanıza gerek yok.
          </p>
        </div>

        {/* GET formu — sonuç sayfası ?no= ile aynı route'a döner, JS gerekmez */}
        <form
          action="/track"
          method="GET"
          className="mx-auto flex max-w-[520px] items-center overflow-hidden rounded-xl border-[1.5px] border-[#e2ddd4] bg-white shadow-sm focus-within:border-[#f5b301]"
        >
          <input
            type="text"
            name="no"
            inputMode="numeric"
            defaultValue={no ?? ""}
            placeholder="Örn. 10000000"
            aria-label="Sevkiyat numarası"
            className="flex-1 bg-transparent px-4 py-3.5 text-[15px] outline-none placeholder:text-muted-foreground/60"
          />
          <button
            type="submit"
            className="flex items-center gap-2 bg-[#1e1e1e] px-5 py-3.5 font-semibold text-white transition hover:bg-[#0a0a0a]"
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Sorgula</span>
          </button>
        </form>

        {searched && !result && (
          <Card className="mx-auto mt-8 max-w-[520px] border-destructive/30">
            <CardContent className="text-center">
              <p className="font-semibold">Sevkiyat bulunamadı</p>
              <p className="text-muted-foreground mt-1 text-sm">
                <span className="font-mono">{no}</span> numarasına ait bir
                sevkiyat bulunamadı. Lütfen numarayı kontrol edip tekrar deneyin.
              </p>
            </CardContent>
          </Card>
        )}

        {result && (
          <div className="mt-8 flex flex-col gap-4">
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

        {!searched && (
          <div className="mx-auto mt-8 max-w-[520px] text-center">
            <Link
              href="/login"
              className="text-sm font-semibold text-[#1e1e1e] underline-offset-4 hover:underline"
            >
              Firma hesabınız mı var? Panele giriş yapın{" "}
              <ArrowRight className="inline size-3.5" />
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
