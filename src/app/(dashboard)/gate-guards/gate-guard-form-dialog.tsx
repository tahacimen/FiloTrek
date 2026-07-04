"use client";

import { useActionState, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import {
  createGateGuardAction,
  updateGateGuardAction,
  type GateGuardFormState,
} from "@/app/(dashboard)/gate-guards/actions";
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
import { confirmSubmit } from "@/lib/confirm-submit";
import type { SerializableGateGuard } from "@/app/(dashboard)/gate-guards/types";

export function GateGuardFormDialog({
  gateGuard,
}: {
  gateGuard?: SerializableGateGuard;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!gateGuard;
  const action = isEdit
    ? updateGateGuardAction.bind(null, gateGuard.id)
    : createGateGuardAction;
  const [state, formAction, isPending] = useActionState<
    GateGuardFormState,
    FormData
  >(action, undefined);

  // Close the dialog on a successful submission — same render-time pattern as DriverFormDialog.
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
            Yeni Nizamiye Kullanıcısı
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Nizamiye Kullanıcısını Düzenle" : "Yeni Nizamiye Kullanıcısı"}
          </DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={confirmSubmit(
            isEdit
              ? "Nizamiye kullanıcısı bilgilerini kaydetmek istediğinize emin misiniz?"
              : "Yeni nizamiye kullanıcısı eklemek istediğinize emin misiniz?"
          )}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName">Ad Soyad</Label>
            <Input
              id="fullName"
              name="fullName"
              required
              defaultValue={gateGuard?.fullName}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={gateGuard?.email}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">
              Şifre
              {isEdit && " (boş bırakılırsa mevcut şifre korunur)"}
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required={!isEdit}
            />
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
