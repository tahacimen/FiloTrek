import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listCustomerCompanies } from "@/core/company/company-repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewShipmentForm } from "@/app/(dashboard)/shipments/new/new-shipment-form";

export default async function NewShipmentPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "SUPPLIER") {
    redirect("/shipments");
  }

  const customers = await listCustomerCompanies();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Yeni Sefer</h1>
        <p className="text-muted-foreground text-sm">
          Bir müşteri için yeni bir sefer kaydı oluşturun. Araç ve şoför
          ataması, sefer oluşturulduktan sonra Atama ekranından yapılır.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sefer Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <NewShipmentForm customers={customers} />
        </CardContent>
      </Card>
    </div>
  );
}
