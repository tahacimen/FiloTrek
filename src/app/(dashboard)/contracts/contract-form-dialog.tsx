"use client";

import { useActionState, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import {
  createContractRateAction,
  updateContractRateAction,
  type ContractFormState,
} from "@/app/(dashboard)/contracts/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProvinceDistrictSelect } from "@/components/province-district-select";
import { contractPricingMethodLabels } from "@/lib/labels";
import { ContractPricingMethod } from "@/generated/prisma/enums";

export type ContractRateDTO = {
  id: string;
  customerCompanyId: string;
  method: ContractPricingMethod;
  destinationProvince: string | null;
  destinationDistrict: string | null;
  amount: number;
};

type CustomerOption = { id: string; name: string };

export function ContractFormDialog({
  customers,
  rate,
}: {
  customers: CustomerOption[];
  rate?: ContractRateDTO;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!rate;
  const action = isEdit
    ? updateContractRateAction.bind(null, rate.id)
    : createContractRateAction;
  const [state, formAction, isPending] = useActionState<
    ContractFormState,
    FormData
  >(action, undefined);

  const [customerId, setCustomerId] = useState(rate?.customerCompanyId ?? "");
  const [method, setMethod] = useState<string>(
    rate?.method ?? ContractPricingMethod.PER_KM
  );

  const [wasPending, setWasPending] = useState(isPending);
  if (wasPending !== isPending) {
    setWasPending(isPending);
    if (wasPending && open && !state?.error) setOpen(false);
  }

  const isLane = method === ContractPricingMethod.LANE_FIXED;
  const amountLabel =
    method === ContractPricingMethod.PER_KM
      ? "Birim Fiyat (TL/km)"
      : method === ContractPricingMethod.PER_TON
        ? "Birim Fiyat (TL/ton)"
        : "Sabit Fiyat (TL)";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus />
            Yeni Sözleşme Kalemi
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Sözleşme Kalemini Düzenle" : "Yeni Sözleşme Kalemi"}
          </DialogTitle>
        </DialogHeader>
        <form key={rate?.id ?? "new"} action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Müşteri</Label>
            <input type="hidden" name="customerCompanyId" value={customerId} />
            <Select value={customerId || undefined} onValueChange={setCustomerId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Müşteri seçin" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Fiyatlandırma Yöntemi</Label>
            <input type="hidden" name="method" value={method} />
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(ContractPricingMethod).map((m) => (
                  <SelectItem key={m} value={m}>
                    {contractPricingMethodLabels[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLane && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Teslim Noktası (hat)</Label>
              <ProvinceDistrictSelect
                defaultProvince={rate?.destinationProvince ?? ""}
                defaultDistrict={rate?.destinationDistrict ?? ""}
              />
              <p className="text-muted-foreground text-xs">
                İlçe seçerseniz yalnızca o ilçeye yapılan teslimatlara uygulanır;
                boş bırakırsanız ildeki tüm teslimatlara.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="amount">{amountLabel}</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={rate?.amount ?? ""}
            />
          </div>

          {state?.error && (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              {isEdit ? "Kaydet" : "Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
