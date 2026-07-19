"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { rejectSignupRequestAction } from "@/app/(dashboard)/admin/actions";
import { ApproveSignupDialog } from "@/app/(dashboard)/admin/approve-signup-dialog";
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
  signupRequestStatusBadgeVariant,
  signupRequestStatusLabels,
} from "@/lib/labels";
import type { InvitationRole, SignupRequestStatus } from "@/generated/prisma/enums";

export type SignupRequestRow = {
  id: string;
  companyName: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: InvitationRole;
  message: string | null;
  status: SignupRequestStatus;
  createdAt: Date;
};

export function SignupRequestTable({ requests }: { requests: SignupRequestRow[] }) {
  const [isPending, startTransition] = useTransition();

  function handleReject(id: string) {
    if (!confirm("Bu kayıt talebini reddetmek istediğinize emin misiniz?")) {
      return;
    }
    startTransition(async () => {
      const result = await rejectSignupRequestAction(id);
      if (result?.error) toast.error(result.error);
      else toast.success("Talep reddedildi.");
    });
  }

  if (requests.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Henüz kayıt talebi yok.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Firma</TableHead>
          <TableHead>Yetkili</TableHead>
          <TableHead>İletişim</TableHead>
          <TableHead>Tür</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead>Tarih</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((r) => {
          const isPendingReq = r.status === "PENDING";
          return (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                {r.companyName}
                {r.message && (
                  <p className="text-muted-foreground mt-0.5 max-w-[240px] truncate text-xs font-normal">
                    {r.message}
                  </p>
                )}
              </TableCell>
              <TableCell>{r.fullName}</TableCell>
              <TableCell>
                <div className="flex flex-col text-sm">
                  <span>{r.email}</span>
                  {r.phone && (
                    <span className="text-muted-foreground text-xs">{r.phone}</span>
                  )}
                </div>
              </TableCell>
              <TableCell>{invitationRoleLabels[r.role]}</TableCell>
              <TableCell>
                <Badge variant={signupRequestStatusBadgeVariant[r.status]}>
                  {signupRequestStatusLabels[r.status]}
                </Badge>
              </TableCell>
              <TableCell>{formatDateTime(r.createdAt)}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  {isPendingReq && (
                    <>
                      <ApproveSignupDialog request={r} />
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isPending}
                        onClick={() => handleReject(r.id)}
                      >
                        <span className="sr-only">Reddet</span>
                        <X />
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
