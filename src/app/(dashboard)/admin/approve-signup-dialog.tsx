"use client";

import { useActionState, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import {
  approveSignupRequestAction,
  type InvitationFormState,
} from "@/app/(dashboard)/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invitationRoleLabels } from "@/lib/labels";
import type { SignupRequestRow } from "@/app/(dashboard)/admin/signup-request-table";

/**
 * "Onayla ve Hesap Oluştur" — the admin only sets a password; company, name,
 * e-mail and role come from the request itself. On success the account exists
 * and the applicant is e-mailed their credentials (see the action).
 */
export function ApproveSignupDialog({ request }: { request: SignupRequestRow }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    InvitationFormState,
    FormData
  >(approveSignupRequestAction.bind(null, request.id), undefined);

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
        <Button variant="ghost" size="icon">
          <span className="sr-only">Onayla ve Hesap Oluştur</span>
          <Check />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Onayla ve Hesap Oluştur</DialogTitle>
          <DialogDescription>
            {request.companyName} · {request.fullName} · {request.email} ·{" "}
            {invitationRoleLabels[request.role]}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`approve-pw-${request.id}`}>
              Kullanıcıya verilecek geçici şifre
            </Label>
            <Input
              id={`approve-pw-${request.id}`}
              name="password"
              type="text"
              minLength={8}
              required
              placeholder="En az 8 karakter"
              autoComplete="off"
            />
            <p className="text-muted-foreground text-xs">
              Hesap oluşturulacak ve bu bilgiler {request.email} adresine
              e-posta ile gönderilecek (SMTP ayarlıysa).
            </p>
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
