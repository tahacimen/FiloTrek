"use client";

import { useTransition } from "react";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { revokeInvitationAction } from "@/app/(dashboard)/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import {
  invitationRoleLabels,
  invitationStatusBadgeVariant,
  invitationStatusLabels,
} from "@/lib/labels";
import type { InvitationRole, InvitationStatus } from "@/generated/prisma/enums";

export type InvitationRow = {
  id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  createdAt: Date;
  expiresAt: Date;
  invitationUrl: string;
};

export function InvitationTable({ invitations }: { invitations: InvitationRow[] }) {
  const [isPending, startTransition] = useTransition();

  function handleCopy(invitation: InvitationRow) {
    navigator.clipboard
      .writeText(invitation.invitationUrl)
      .then(() => toast.success("Davet linki kopyalandı."))
      .catch(() => toast.error("Link kopyalanamadı."));
  }

  function handleRevoke(invitation: InvitationRow) {
    if (
      !confirm(`${invitation.email} adresine gönderilen daveti iptal etmek istediğinize emin misiniz?`)
    ) {
      return;
    }
    startTransition(async () => {
      const result = await revokeInvitationAction(invitation.id);
      if (result?.error) toast.error(result.error);
      else toast.success("Davet iptal edildi.");
    });
  }

  if (invitations.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Henüz davet gönderilmedi.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>E-posta</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead>Oluşturulma</TableHead>
          <TableHead>Son Geçerlilik</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.map((invitation) => {
          const isPendingInvite = invitation.status === "PENDING";
          return (
            <TableRow key={invitation.id}>
              <TableCell className="font-medium">{invitation.email}</TableCell>
              <TableCell>{invitationRoleLabels[invitation.role]}</TableCell>
              <TableCell>
                <Badge variant={invitationStatusBadgeVariant[invitation.status]}>
                  {invitationStatusLabels[invitation.status]}
                </Badge>
              </TableCell>
              <TableCell>{formatDateTime(invitation.createdAt)}</TableCell>
              <TableCell>{formatDateTime(invitation.expiresAt)}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  {isPendingInvite && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(invitation)}
                      >
                        <span className="sr-only">Linki Kopyala</span>
                        <Copy />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isPending}
                        onClick={() => handleRevoke(invitation)}
                      >
                        <span className="sr-only">İptal Et</span>
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
