"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { removeContractRateAction } from "@/app/(dashboard)/contracts/actions";
import {
  ContractFormDialog,
  type ContractRateDTO,
} from "@/app/(dashboard)/contracts/contract-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { contractPricingMethodLabels } from "@/lib/labels";
import { ContractPricingMethod } from "@/generated/prisma/enums";

type Row = ContractRateDTO & { customerName: string };
type CustomerOption = { id: string; name: string };

function amountDisplay(r: Row): string {
  const tl = r.amount.toLocaleString("tr-TR");
  if (r.method === ContractPricingMethod.PER_KM) return `${tl} ₺/km`;
  if (r.method === ContractPricingMethod.PER_TON) return `${tl} ₺/ton`;
  return `${tl} ₺`;
}

function scopeDisplay(r: Row): string {
  if (r.method !== ContractPricingMethod.LANE_FIXED) return "Tüm teslimatlar";
  if (r.destinationDistrict)
    return `${r.destinationProvince} / ${r.destinationDistrict}`;
  return r.destinationProvince ?? "—";
}

export function ContractTable({
  rows,
  customers,
}: {
  rows: Row[];
  customers: CustomerOption[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleRemove(r: Row) {
    if (!confirm("Bu sözleşme kalemini silmek istediğinize emin misiniz?")) return;
    startTransition(async () => {
      const result = await removeContractRateAction(r.id);
      if (result?.error) toast.error(result.error);
      else toast.success("Sözleşme kalemi silindi.");
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Henüz sözleşme kalemi yok. Bir müşteri için fiyat tanımlayın; o müşteri
        size araç çağırdığında fiyat otomatik gelir.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Müşteri</TableHead>
          <TableHead>Yöntem</TableHead>
          <TableHead>Kapsam</TableHead>
          <TableHead>Fiyat</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">{r.customerName}</TableCell>
            <TableCell>{contractPricingMethodLabels[r.method]}</TableCell>
            <TableCell>{scopeDisplay(r)}</TableCell>
            <TableCell>{amountDisplay(r)}</TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <ContractFormDialog customers={customers} rate={r} />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => handleRemove(r)}
                >
                  <span className="sr-only">Sil</span>
                  <Trash2 />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
