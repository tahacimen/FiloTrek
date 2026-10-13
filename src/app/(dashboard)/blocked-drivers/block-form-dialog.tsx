"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import {
  addDriverBlockAction,
  type BlockFormState,
} from "@/app/(dashboard)/blocked-drivers/actions";
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

export function BlockFormDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    BlockFormState,
    FormData
  >(addDriverBlockAction, undefined);

  const [wasPending, setWasPending] = useState(isPending);
  if (wasPending !== isPending) {
    setWasPending(isPending);
    if (wasPending && open && !state?.error) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Engel Ekle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sürücü Engelle</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            TC kimlik veya ehliyet numarasından en az birini girin. Bu kişi
            seferlerinize atanamaz.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName">Ad Soyad (opsiyonel)</Label>
            <Input id="fullName" name="fullName" placeholder="Örn. Ahmet Yılmaz" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tcNumber">TC Kimlik No</Label>
              <Input
                id="tcNumber"
                name="tcNumber"
                inputMode="numeric"
                maxLength={11}
                placeholder="11 haneli"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="licenseNumber">Ehliyet No</Label>
              <Input id="licenseNumber" name="licenseNumber" placeholder="Örn. 34DR1001" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">Açıklama (opsiyonel)</Label>
            <Input id="reason" name="reason" placeholder="Neden engellendi?" />
          </div>
          {state?.error && (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Engelle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
