import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listSupplierCompanies } from "@/core/company/company-repository";
import { listWarehouses } from "@/core/warehouse/warehouse-service";
import { listConsignees } from "@/core/consignee/consignee-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestShipmentGrid } from "@/app/(dashboard)/shipments/request/request-shipment-grid";

export default async function RequestShipmentPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "CUSTOMER") {
    redirect("/shipments");
  }

  const [suppliers, warehouses, consigneeRows] = await Promise.all([
    listSupplierCompanies(ctx.isDemo),
    listWarehouses(ctx),
    listConsignees(ctx),
  ]);
  const loadingPoints = warehouses.map((w) => ({
    id: w.id,
    name: w.name,
    address: w.address,
    mapsUrl: w.mapsUrl,
    isDefault: w.isDefault,
  }));
  const consignees = consigneeRows.map((c) => ({
    id: c.id,
    title: c.title,
    province: c.province,
    district: c.district,
    address: c.address,
  }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Araç Çağır</h1>
        <p className="text-muted-foreground text-sm">
          Her satır bir taleptir. Tek bir talep için bir satır doldurun ya da
          birden fazla satır ekleyip seçtiklerinizi topluca oluşturun. Tedarikçi
          seçerseniz talep ona iletilir; &quot;Pazara Aç&quot; derseniz
          tedarikçilerden teklif toplanır.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Yük Talepleri</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestShipmentGrid
            suppliers={suppliers}
            loadingPoints={loadingPoints}
            consignees={consignees}
          />
        </CardContent>
      </Card>
    </div>
  );
}
