"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { createWarehouseAction, type WarehouseFormState } from "@/app/(dashboard)/warehouses/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { confirmSubmit } from "@/lib/confirm-submit";

export function WarehouseFormDialog() {
  const [open, setOpen] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [state, formAction, isPending] = useActionState<
    WarehouseFormState,
    FormData
  >(createWarehouseAction, undefined);

  const [wasPending, setWasPending] = useState(isPending);
  if (wasPending !== isPending) {
    setWasPending(isPending);
    if (wasPending && open && !state?.error) {
      setOpen(false);
      setIsDefault(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Yeni Depo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Depo Ekle</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={confirmSubmit("Yeni depo eklemek istediğinize emin misiniz?")}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Depo Adı</Label>
            <Input id="name" name="name" required placeholder="Merkez Depo" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="address">Adres (opsiyonel)</Label>
            <Input
              id="address"
              name="address"
              placeholder="Hadımköy, İstanbul"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="mapsUrl">Harita Linki (opsiyonel)</Label>
            <Input
              id="mapsUrl"
              name="mapsUrl"
              type="url"
              placeholder="https://maps.google.com/..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isDefault"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
            />
            <input type="hidden" name="isDefault" value={isDefault ? "true" : ""} />
            <Label htmlFor="isDefault" className="font-normal">
              Varsayılan yükleme noktam yap (Araç Çağır ekranında hazır gelsin)
            </Label>
          </div>
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Ekle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
