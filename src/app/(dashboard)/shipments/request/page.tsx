import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listSupplierCompanies } from "@/core/company/company-repository";
import { listWarehouses } from "@/core/warehouse/warehouse-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestShipmentForm } from "@/app/(dashboard)/shipments/request/request-shipment-form";

export default async function RequestShipmentPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "CUSTOMER") {
    redirect("/shipments");
  }

  const [suppliers, warehouses] = await Promise.all([
    listSupplierCompanies(),
    listWarehouses(ctx),
  ]);
  const loadingPoints = warehouses.map((w) => ({
    id: w.id,
    name: w.name,
    address: w.address,
    mapsUrl: w.mapsUrl,
    isDefault: w.isDefault,
  }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Araç Çağır</h1>
        <p className="text-muted-foreground text-sm">
          Bir tedarikçi seçip yük bilgilerinizi girin — talebiniz seçtiğiniz
          tedarikçinin bildirimlerine düşer.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Yük Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestShipmentForm suppliers={suppliers} loadingPoints={loadingPoints} />
        </CardContent>
      </Card>
    </div>
  );
}
