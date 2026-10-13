import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listVehicles } from "@/core/vehicle/vehicle-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VehicleFormDialog } from "@/app/(dashboard)/vehicles/vehicle-form-dialog";
import { VehicleTable } from "@/app/(dashboard)/vehicles/vehicle-table";
import { toSerializableVehicle } from "@/app/(dashboard)/vehicles/types";
import { vehicleNeedsDocAttention } from "@/lib/vehicle-docs";

export default async function VehiclesPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "SUPPLIER") {
    redirect("/dashboard");
  }
  const vehicles = (await listVehicles(ctx)).map(toSerializableVehicle);
  const docAttentionCount = vehicles.filter(vehicleNeedsDocAttention).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Araçlar</h1>
          <p className="text-muted-foreground text-sm">
            Filonuzdaki araçları yönetin.
          </p>
        </div>
        <VehicleFormDialog />
      </div>
      {docAttentionCount > 0 && (
        <div className="rounded-lg border-[1.5px] border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">{docAttentionCount} araçta</span> belge
          süresi yaklaşıyor veya dolmuş (muayene / trafik sigortası). Aşağıdaki
          “Belgeler” sütununu kontrol edin.
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Tüm Araçlar ({vehicles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <VehicleTable vehicles={vehicles} />
        </CardContent>
      </Card>
    </div>
  );
}
