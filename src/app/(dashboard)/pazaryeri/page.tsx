import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, ReceiptText } from "lucide-react";

import { requireTenantContext } from "@/core/shared/tenant-context";
import * as marketplaceService from "@/core/marketplace/marketplace-service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BidFormDialog } from "@/app/(dashboard)/pazaryeri/bid-form-dialog";
import { BidCountdown } from "@/components/bid-countdown";

type MarketShipment = Awaited<
  ReturnType<typeof marketplaceService.listOpenShipmentsForBidding>
>[number];

/** One biddable shipment row — shared by the open pool and the invite list. */
function MarketRow({ shipment }: { shipment: MarketShipment }) {
  const myBid = shipment.bids[0];
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-medium">
          {shipment.originAddress} → {shipment.destinationAddress}
        </p>
        <p className="text-muted-foreground text-xs">
          {shipment.customerCompany.name} · {shipment.tonnage.toString()} ton ·{" "}
          {shipment.distanceKm.toString()} km
        </p>
        {shipment.cargoDescription && (
          <p className="text-muted-foreground text-xs">
            {shipment.cargoDescription}
          </p>
        )}
        {shipment.biddingDeadline && (
          <BidCountdown
            deadline={new Date(shipment.biddingDeadline).toISOString()}
            className="mt-0.5"
          />
        )}
        {myBid && (
          <p className="text-brand text-xs font-medium">
            Teklifiniz: {myBid.price.toString()} ₺
            {myBid.transitDays != null && ` · ${myBid.transitDays} gün transit`}
          </p>
        )}
      </div>
      <BidFormDialog
        shipmentId={shipment.id}
        existingBid={
          myBid
            ? {
                price: myBid.price.toNumber(),
                message: myBid.message,
                transitDays: myBid.transitDays,
                validUntil: myBid.validUntil
                  ? new Date(myBid.validUntil).toISOString().slice(0, 10)
                  : null,
              }
            : undefined
        }
      />
    </div>
  );
}

export default async function PazaryeriPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "SUPPLIER") {
    redirect("/dashboard");
  }

  const [shipments, invited] = await Promise.all([
    marketplaceService.listOpenShipmentsForBidding(ctx),
    marketplaceService.listInvitedShipmentsForBidding(ctx),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pazaryeri</h1>
          <p className="text-muted-foreground text-sm">
            Müşterilerin belirli bir tedarikçi seçmeden pazara açtığı seferler —
            teklif verin, müşteri en uygun teklifi kabul etsin.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/tekliflerim">
            <ReceiptText />
            Tekliflerim
          </Link>
        </Button>
      </div>

      {invited.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="text-amber-600 size-4" />
              Size Özel Davetler
              <Badge variant="warning">{invited.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y">
              {invited.map((shipment) => (
                <MarketRow key={shipment.id} shipment={shipment} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Açık Seferler ({shipments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {shipments.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Şu anda pazarda açık sefer bulunmuyor.
            </p>
          ) : (
            <div className="flex flex-col divide-y">
              {shipments.map((shipment) => (
                <MarketRow key={shipment.id} shipment={shipment} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
