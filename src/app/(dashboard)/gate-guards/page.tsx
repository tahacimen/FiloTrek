import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listGateGuards } from "@/core/gate-guard/gate-guard-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GateGuardFormDialog } from "@/app/(dashboard)/gate-guards/gate-guard-form-dialog";
import { GateGuardTable } from "@/app/(dashboard)/gate-guards/gate-guard-table";
import { toSerializableGateGuard } from "@/app/(dashboard)/gate-guards/types";

export default async function GateGuardsPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "CUSTOMER") {
    redirect("/dashboard");
  }
  const gateGuards = (await listGateGuards(ctx)).map(toSerializableGateGuard);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nizamiye</h1>
          <p className="text-muted-foreground text-sm">
            Tesisinize giren/çıkan araçları kaydeden nizamiye kullanıcılarını
            yönetin.
          </p>
        </div>
        <GateGuardFormDialog />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tüm Nizamiye Kullanıcıları ({gateGuards.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <GateGuardTable gateGuards={gateGuards} />
        </CardContent>
      </Card>
    </div>
  );
}
