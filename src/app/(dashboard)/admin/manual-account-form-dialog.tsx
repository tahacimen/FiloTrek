"use client";

import { useActionState, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";

import {
  createAccountManuallyAction,
  type InvitationFormState,
} from "@/app/(dashboard)/admin/actions";
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
import { confirmSubmit } from "@/lib/confirm-submit";
import { invitationRoleLabels } from "@/lib/labels";

/** Bypasses the /davet link entirely — the admin sets the password themselves, on the spot, for someone who can't complete the invite flow on their own. */
export function ManualAccountFormDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    InvitationFormState,
    FormData
  >(createAccountManuallyAction, undefined);

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
        <Button variant="outline">
          <KeyRound />
          Manuel Hesap Oluştur
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manuel Hesap Oluştur</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={confirmSubmit(
            "Bu bilgilerle doğrudan bir hesap oluşturmak istediğinize emin misiniz?"
          )}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="manualEmail">E-posta</Label>
            <Input id="manualEmail" name="email" type="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="manualRole">Rol</Label>
            <Select name="role" required>
              <SelectTrigger id="manualRole" className="w-full">
                <SelectValue placeholder="Seçin" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(invitationRoleLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="manualCompanyName">Firma Adı</Label>
            <Input id="manualCompanyName" name="companyName" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="manualFullName">Ad Soyad</Label>
            <Input id="manualFullName" name="fullName" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="manualPassword">Şifre</Label>
            <Input
              id="manualPassword"
              name="password"
              type="password"
              minLength={8}
              required
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
              Hesabı Oluştur
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
