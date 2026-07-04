import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listShipments } from "@/core/shipment/shipment-service";
import { listVehicles } from "@/core/vehicle/vehicle-service";
import { listDrivers } from "@/core/driver/driver-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssignDialog } from "@/app/(dashboard)/assign/assign-dialog";
import { toSerializableVehicle } from "@/app/(dashboard)/vehicles/types";
import { toSerializableDriver } from "@/app/(dashboard)/drivers/types";
import { VehicleStatus, DriverStatus } from "@/generated/prisma/client";

export default async function AssignPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "SUPPLIER") {
    redirect("/dashboard");
  }

  const [allShipments, availableVehiclesRaw, availableDriversRaw] =
    await Promise.all([
      listShipments(ctx),
      listVehicles(ctx, { status: VehicleStatus.AVAILABLE }),
      listDrivers(ctx, { status: DriverStatus.AVAILABLE }),
    ]);
  const availableVehicles = availableVehiclesRaw.map(toSerializableVehicle);
  const availableDrivers = availableDriversRaw.map(toSerializableDriver);

  const pendingShipments = allShipments.filter(
    (s) => s.status === "PENDING" && s.supplierCompanyId === ctx.companyId
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Atama</h1>
        <p className="text-muted-foreground text-sm">
          Atama bekleyen seferlere müsait araç ve şoför eşleştirin. Şu an{" "}
          {availableVehicles.length} müsait araç ve {availableDrivers.length}{" "}
          müsait şoför var.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Atama Bekleyen Seferler ({pendingShipments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingShipments.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Atama bekleyen sefer bulunmuyor.
            </p>
          ) : (
            <div className="flex flex-col divide-y">
              {pendingShipments.map((shipment) => (
                <div
                  key={shipment.id}
                  data-testid="pending-shipment-row"
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {shipment.originAddress} → {shipment.destinationAddress}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {shipment.customerCompany.name} · {shipment.tonnage.toString()}{" "}
                      ton
                    </p>
                  </div>
                  <AssignDialog
                    shipmentId={shipment.id}
                    route={`${shipment.originAddress} → ${shipment.destinationAddress}`}
                    availableVehicles={availableVehicles}
                    availableDrivers={availableDrivers}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
