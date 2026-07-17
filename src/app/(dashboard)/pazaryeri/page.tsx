import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import * as marketplaceService from "@/core/marketplace/marketplace-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BidFormDialog } from "@/app/(dashboard)/pazaryeri/bid-form-dialog";

export default async function PazaryeriPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "SUPPLIER") {
    redirect("/dashboard");
  }

  const shipments = await marketplaceService.listOpenShipmentsForBidding(ctx);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pazaryeri</h1>
        <p className="text-muted-foreground text-sm">
          Müşterilerin belirli bir tedarikçi seçmeden pazara açtığı seferler —
          teklif verin, müşteri en uygun teklifi kabul etsin.
        </p>
      </div>
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
              {shipments.map((shipment) => {
                const myBid = shipment.bids[0];
                return (
                  <div
                    key={shipment.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {shipment.originAddress} → {shipment.destinationAddress}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {shipment.customerCompany.name} ·{" "}
                        {shipment.tonnage.toString()} ton ·{" "}
                        {shipment.distanceKm.toString()} km
                      </p>
                      {shipment.cargoDescription && (
                        <p className="text-muted-foreground text-xs">
                          {shipment.cargoDescription}
                        </p>
                      )}
                      {myBid && (
                        <p className="text-brand text-xs font-medium">
                          Teklifiniz: {myBid.price.toString()} ₺
                        </p>
                      )}
                    </div>
                    <BidFormDialog
                      shipmentId={shipment.id}
                      existingBid={
                        myBid
                          ? { price: myBid.price.toNumber(), message: myBid.message }
                          : undefined
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
