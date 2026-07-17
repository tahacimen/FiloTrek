import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listWarehouses } from "@/core/warehouse/warehouse-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  dockReservationTypeLabels,
  vehicleBedTypeLabels,
  vehicleTypeLabels,
} from "@/lib/labels";
import { WarehouseFormDialog } from "@/app/(dashboard)/warehouses/warehouse-form-dialog";
import { DockFormDialog } from "@/app/(dashboard)/warehouses/dock-form-dialog";
import { DefaultWarehouseControl } from "@/app/(dashboard)/warehouses/default-warehouse-button";

export default async function WarehousesPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "CUSTOMER") {
    redirect("/dashboard");
  }
  const warehouses = await listWarehouses(ctx);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Depo & Rampa</h1>
          <p className="text-muted-foreground text-sm">
            Depolarınızı, rampalarınızı ve kapı rezervasyonlarını yönetin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/warehouses/report">
              <BarChart3 />
              Rapor
            </Link>
          </Button>
          <WarehouseFormDialog />
        </div>
      </div>

      {warehouses.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            Henüz depo eklenmedi. Başlamak için &ldquo;Yeni Depo&rdquo; butonunu kullanın.
          </CardContent>
        </Card>
      )}

      {warehouses.map((warehouse) => (
        <Card key={warehouse.id}>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{warehouse.name}</CardTitle>
                <DefaultWarehouseControl
                  warehouseId={warehouse.id}
                  isDefault={warehouse.isDefault}
                />
              </div>
              {warehouse.address && (
                <p className="text-muted-foreground mt-1 text-sm">
                  {warehouse.address}
                  {warehouse.mapsUrl && (
                    <>
                      {" · "}
                      <a
                        href={warehouse.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        Haritada Gör
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>
            <DockFormDialog warehouseId={warehouse.id} />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {warehouse.docks.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Bu depoda henüz rampa tanımlanmadı.
              </p>
            )}
            {warehouse.docks.map((dock) => (
              <div
                key={dock.id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1.5">
                  <span className="font-medium">{dock.name}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {dock.supportedReservationTypes.map((type) => (
                      <Badge key={type} variant="secondary">
                        {dockReservationTypeLabels[type]}
                      </Badge>
                    ))}
                    {dock.supportedVehicleTypes.map((type) => (
                      <Badge key={type} variant="outline">
                        {vehicleTypeLabels[type]}
                      </Badge>
                    ))}
                    {dock.supportedBedTypes.map((type) => (
                      <Badge key={type} variant="outline">
                        {vehicleBedTypeLabels[type]}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    Slot süresi: {dock.slotDurationMinutes} dk
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <DockFormDialog warehouseId={warehouse.id} dock={dock} />
                  <Button asChild size="sm">
                    <Link href={`/warehouses/${warehouse.id}/docks/${dock.id}`}>
                      Takvimi Aç
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
