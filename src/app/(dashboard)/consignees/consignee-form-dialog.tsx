"use client";

import { useActionState, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import {
  createConsigneeAction,
  updateConsigneeAction,
  type ConsigneeFormState,
} from "@/app/(dashboard)/consignees/actions";
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
import { ProvinceDistrictSelect } from "@/components/province-district-select";

export type ConsigneeDTO = {
  id: string;
  title: string;
  province: string;
  district: string;
  address: string | null;
  phone: string | null;
  taxNumber: string | null;
};

export function ConsigneeFormDialog({ consignee }: { consignee?: ConsigneeDTO }) {
  const [open, setOpen] = useState(false);
  const isEdit = !!consignee;
  const action = isEdit
    ? updateConsigneeAction.bind(null, consignee.id)
    : createConsigneeAction;
  const [state, formAction, isPending] = useActionState<
    ConsigneeFormState,
    FormData
  >(action, undefined);

  const [wasPending, setWasPending] = useState(isPending);
  if (wasPending !== isPending) {
    setWasPending(isPending);
    if (wasPending && open && !state?.error) setOpen(false);
  }

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
            Yeni Cari
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Cariyi Düzenle" : "Yeni Cari Ekle"}</DialogTitle>
        </DialogHeader>
        {/* key forces the uncontrolled province/district picker to reset to the
            right defaults each time the dialog opens for a different row. */}
        <form
          key={consignee?.id ?? "new"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Ünvan / Firma Adı</Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={consignee?.title}
              placeholder="Örn. Kemalpaşa Gıda Ltd. Şti."
            />
          </div>
          <ProvinceDistrictSelect
            required
            defaultProvince={consignee?.province ?? ""}
            defaultDistrict={consignee?.district ?? ""}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="address">Açık Adres (opsiyonel)</Label>
            <Input
              id="address"
              name="address"
              defaultValue={consignee?.address ?? ""}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Telefon (opsiyonel)</Label>
              <Input id="phone" name="phone" defaultValue={consignee?.phone ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="taxNumber">Vergi No / VKN (opsiyonel)</Label>
              <Input
                id="taxNumber"
                name="taxNumber"
                defaultValue={consignee?.taxNumber ?? ""}
              />
            </div>
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
