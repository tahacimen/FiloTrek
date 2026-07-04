import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listVehicles } from "@/core/vehicle/vehicle-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VehicleFormDialog } from "@/app/(dashboard)/vehicles/vehicle-form-dialog";
import { VehicleTable } from "@/app/(dashboard)/vehicles/vehicle-table";
import { toSerializableVehicle } from "@/app/(dashboard)/vehicles/types";

export default async function VehiclesPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "SUPPLIER") {
    redirect("/dashboard");
  }
  const vehicles = (await listVehicles(ctx)).map(toSerializableVehicle);

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
