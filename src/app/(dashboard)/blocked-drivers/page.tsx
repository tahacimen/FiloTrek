import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listDriverBlocks } from "@/core/driver-block/driver-block-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlockTable } from "@/app/(dashboard)/blocked-drivers/block-table";
import { BlockFormDialog } from "@/app/(dashboard)/blocked-drivers/block-form-dialog";

export default async function BlockedDriversPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "CUSTOMER") {
    redirect("/dashboard");
  }
  const blocks = await listDriverBlocks(ctx);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Engelli Sürücüler
          </h1>
          <p className="text-muted-foreground text-sm">
            TC kimlik veya ehliyet numarasıyla engellediğiniz kişiler
            seferlerinize atanamaz.
          </p>
        </div>
        <BlockFormDialog />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Engel Listesi ({blocks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <BlockTable blocks={blocks} />
        </CardContent>
      </Card>
    </div>
  );
}
