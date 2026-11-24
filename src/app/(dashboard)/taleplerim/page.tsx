import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listMarketplaceRequestsForCustomer } from "@/core/marketplace/marketplace-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RequestProcessView,
  type RequestRow,
} from "@/app/(dashboard)/taleplerim/request-process-view";

export default async function TaleplerimPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "CUSTOMER") {
    redirect("/dashboard");
  }

  const requests = await listMarketplaceRequestsForCustomer(ctx);
  const rows: RequestRow[] = requests.map((s) => {
    // Active offers = everything except withdrawn ones.
    const activeBids = s.bids.filter((b) => b.status !== "WITHDRAWN");
    const lowestBid = activeBids.length
      ? Math.min(...activeBids.map((b) => b.price.toNumber()))
      : null;
    return {
      id: s.id,
      trackingNumber: s.trackingNumber,
      originAddress: s.originAddress,
      destinationAddress: s.destinationAddress,
      tonnage: s.tonnage.toString(),
      createdAt: s.createdAt,
      biddingDeadline: s.biddingDeadline
        ? new Date(s.biddingDeadline).toISOString()
        : null,
      supplierCompanyId: s.supplierCompanyId,
      awardedSupplierName: s.supplierCompany?.name ?? null,
      bidCount: activeBids.length,
      lowestBid,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Teklif Taleplerim
        </h1>
        <p className="text-muted-foreground text-sm">
          Pazara açtığınız taleplerin teklif süreci — kaç teklif geldi, hangisi
          karara bağlandı, hangisi hâlâ açık.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Süreç Özeti</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestProcessView rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
