import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listMyBids } from "@/core/marketplace/marketplace-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MyBidsView,
  type MyBidRow,
} from "@/app/(dashboard)/tekliflerim/my-bids-view";

export default async function TekliflerimPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "SUPPLIER") {
    redirect("/dashboard");
  }

  const bids = await listMyBids(ctx);
  const rows: MyBidRow[] = bids.map((bid) => ({
    id: bid.id,
    createdAt: bid.createdAt,
    status: bid.status,
    price: bid.price.toNumber(),
    shipment: {
      id: bid.shipment.id,
      originAddress: bid.shipment.originAddress,
      destinationAddress: bid.shipment.destinationAddress,
      tonnage: bid.shipment.tonnage.toString(),
      status: bid.shipment.status,
      customerCompany: bid.shipment.customerCompany
        ? { name: bid.shipment.customerCompany.name }
        : null,
      // The winning supplier is only meaningful (and only shown) for a bid
      // this supplier lost — the shipment went to someone else.
      winnerName:
        bid.shipment.supplierCompanyId &&
        bid.shipment.supplierCompanyId !== ctx.companyId
          ? (bid.shipment.supplierCompany?.name ?? null)
          : null,
    },
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tekliflerim</h1>
        <p className="text-muted-foreground text-sm">
          Pazaryerinde verdiğiniz tekliflerin geçmişi ve sonuçları — kazanılan,
          kaybedilen ve bekleyen işler.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Teklif Geçmişi</CardTitle>
        </CardHeader>
        <CardContent>
          <MyBidsView bids={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
