import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listDrivers } from "@/core/driver/driver-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DriverFormDialog } from "@/app/(dashboard)/drivers/driver-form-dialog";
import { DriverTable } from "@/app/(dashboard)/drivers/driver-table";
import { toSerializableDriver } from "@/app/(dashboard)/drivers/types";

export default async function DriversPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "SUPPLIER") {
    redirect("/dashboard");
  }
  const drivers = (await listDrivers(ctx)).map(toSerializableDriver);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Şoförler</h1>
          <p className="text-muted-foreground text-sm">
            Filonuzdaki şoförleri yönetin.
          </p>
        </div>
        <DriverFormDialog />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tüm Şoförler ({drivers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DriverTable drivers={drivers} />
        </CardContent>
      </Card>
    </div>
  );
}
