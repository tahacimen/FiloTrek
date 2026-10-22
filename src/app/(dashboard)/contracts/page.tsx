import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listContractRates } from "@/core/contract/contract-service";
import { listCustomerCompanies } from "@/core/company/company-repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractFormDialog } from "@/app/(dashboard)/contracts/contract-form-dialog";
import { ContractTable } from "@/app/(dashboard)/contracts/contract-table";

export default async function ContractsPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "SUPPLIER") {
    redirect("/dashboard");
  }

  const [rates, customers] = await Promise.all([
    listContractRates(ctx),
    listCustomerCompanies(ctx.isDemo),
  ]);

  const rows = rates.map((r) => ({
    id: r.id,
    customerCompanyId: r.customerCompanyId,
    customerName: r.customerCompany.name,
    method: r.method,
    destinationProvince: r.destinationProvince,
    destinationDistrict: r.destinationDistrict,
    amount: r.amount.toNumber(),
  }));
  const customerOptions = customers.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Sözleşmeler & Fiyat Listesi
          </h1>
          <p className="text-muted-foreground text-sm">
            Müşteri bazlı anlaşmalı fiyatlarınız. Bir müşteri size doğrudan araç
            çağırdığında eşleşen kalem varsa fiyat otomatik gelir ve pazarlık
            gerekmez.
          </p>
        </div>
        <ContractFormDialog customers={customerOptions} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sözleşme Kalemleri ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractTable rows={rows} customers={customerOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
