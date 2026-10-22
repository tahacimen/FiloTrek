import Link from "next/link";
import { redirect } from "next/navigation";
import { Truck } from "lucide-react";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BulkRequestForm } from "@/app/(dashboard)/shipments/toplu/bulk-request-form";

export default async function BulkRequestPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== "CUSTOMER") {
    redirect("/shipments");
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Toplu Araç Çağır
          </h1>
          <p className="text-muted-foreground text-sm">
            Excel şablonuyla tek seferde çok sayıda araç talebi oluşturun.
            Geçerli satırlar oluşturulur, hatalı satırlar raporlanır.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/shipments/request">
            <Truck />
            Tekli Talep
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Excel ile Toplu Talep</CardTitle>
        </CardHeader>
        <CardContent>
          <BulkRequestForm />
        </CardContent>
      </Card>
    </div>
  );
}
