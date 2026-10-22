import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listConsignees } from "@/core/consignee/consignee-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsigneeFormDialog } from "@/app/(dashboard)/consignees/consignee-form-dialog";
import { ConsigneeTable } from "@/app/(dashboard)/consignees/consignee-table";

export default async function ConsigneesPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "CUSTOMER") {
    redirect("/dashboard");
  }
  const consignees = (await listConsignees(ctx)).map((c) => ({
    id: c.id,
    title: c.title,
    province: c.province,
    district: c.district,
    address: c.address,
    phone: c.phone,
    taxNumber: c.taxNumber,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cariler</h1>
          <p className="text-muted-foreground text-sm">
            Malı teslim alan carileriniz (alıcılar). Araç çağırırken teslim
            noktası olarak seçersiniz; il/ilçe otomatik gelir.
          </p>
        </div>
        <ConsigneeFormDialog />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tüm Cariler ({consignees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ConsigneeTable consignees={consignees} />
        </CardContent>
      </Card>
    </div>
  );
}
