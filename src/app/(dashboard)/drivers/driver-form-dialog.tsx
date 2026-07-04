"use client";

import { useActionState, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import {
  createDriverAction,
  updateDriverAction,
  type DriverFormState,
} from "@/app/(dashboard)/drivers/actions";
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
import { Separator } from "@/components/ui/separator";
import { confirmSubmit } from "@/lib/confirm-submit";
import type { SerializableDriver } from "@/app/(dashboard)/drivers/types";

export function DriverFormDialog({ driver }: { driver?: SerializableDriver }) {
  const [open, setOpen] = useState(false);
  const isEdit = !!driver;
  const action = isEdit
    ? updateDriverAction.bind(null, driver.id)
    : createDriverAction;
  const [state, formAction, isPending] = useActionState<
    DriverFormState,
    FormData
  >(action, undefined);

  // Close the dialog on a successful submission. Adjusted during render
  // (React's documented pattern for this) rather than in a useEffect, since
  // `state` alone can't distinguish "no submission yet" from "just
  // succeeded" (both are `undefined`) — the isPending transition can.
  const [wasPending, setWasPending] = useState(isPending);
  if (wasPending !== isPending) {
    setWasPending(isPending);
    if (wasPending && open && !state?.error) {
      setOpen(false);
    }
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
            Yeni Şoför
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Şoförü Düzenle" : "Yeni Şoför Ekle"}
          </DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={confirmSubmit(
            isEdit
              ? "Şoför bilgilerini kaydetmek istediğinize emin misiniz?"
              : "Yeni şoför eklemek istediğinize emin misiniz?"
          )}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName">Ad Soyad</Label>
            <Input
              id="fullName"
              name="fullName"
              required
              defaultValue={driver?.fullName}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              name="phone"
              required
              defaultValue={driver?.phone}
              placeholder="0532 111 11 11"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="licenseNumber">Ehliyet Numarası</Label>
            <Input
              id="licenseNumber"
              name="licenseNumber"
              required
              defaultValue={driver?.licenseNumber}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tcNumber">TC Kimlik No (opsiyonel)</Label>
              <Input
                id="tcNumber"
                name="tcNumber"
                defaultValue={driver?.tcNumber ?? ""}
                maxLength={11}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="experienceYears">Deneyim (yıl, opsiyonel)</Label>
              <Input
                id="experienceYears"
                name="experienceYears"
                type="number"
                step="1"
                min="0"
                defaultValue={driver?.experienceYears ?? ""}
              />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-medium">Giriş Bilgileri</h3>
              <p className="text-muted-foreground text-xs">
                Şoförün kendi ekranından ({" "}
                <span className="font-mono">/driver</span>) giriş
                yapabilmesi için e-posta ve şifre tanımlayın. Boş
                bırakılırsa şoförün girişi olmaz.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={driver?.email ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">
                Şifre
                {isEdit && " (boş bırakılırsa mevcut şifre korunur)"}
              </Label>
              <Input id="password" name="password" type="password" />
            </div>
          </div>
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
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
