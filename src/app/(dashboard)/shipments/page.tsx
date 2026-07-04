import Link from "next/link";
import { Plus, Truck } from "lucide-react";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listShipments } from "@/core/shipment/shipment-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShipmentTable } from "@/app/(dashboard)/shipments/shipment-table";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";

export default async function ShipmentsPage() {
  const ctx = await requireTenantContext();
  const shipments = await listShipments(ctx);
  const isSupplier = ctx.companyType === "SUPPLIER";

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isSupplier ? "Seferler" : "Seferlerim"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isSupplier
              ? "Oluşturduğunuz ve yürüttüğünüz seferleri görüntüleyin."
              : "Firmanıza ait seferlerin durumunu takip edin."}
          </p>
        </div>
        {isSupplier ? (
          <Button asChild>
            <Link href="/shipments/new">
              <Plus />
              Yeni Sefer
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/shipments/request">
              <Truck />
              Araç Çağır
            </Link>
          </Button>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tüm Seferler ({shipments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ShipmentTable
            shipments={shipments}
            viewerCompanyType={ctx.companyType}
          />
        </CardContent>
      </Card>
    </div>
  );
}
