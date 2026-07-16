"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import {
  createInvitationAction,
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

export function InvitationFormDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    InvitationFormState,
    FormData
  >(createInvitationAction, undefined);

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
        <Button>
          <Plus />
          Yeni Davet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Davet Gönder</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={confirmSubmit(
            "Bu e-posta adresine davet göndermek istediğinize emin misiniz?"
          )}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="role">Rol</Label>
            <Select name="role" required>
              <SelectTrigger id="role" className="w-full">
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
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Davet Gönder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
