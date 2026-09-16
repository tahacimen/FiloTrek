"use client";

import { useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { setDemoRequestStatusAction } from "@/app/(dashboard)/admin/actions";
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
  demoRequestStatusBadgeVariant,
  demoRequestStatusLabels,
} from "@/lib/labels";
import type { DemoRequestStatus } from "@/generated/prisma/enums";

export type DemoRequestRow = {
  id: string;
  fullName: string;
  companyName: string;
  phone: string;
  email: string;
  vehicleCount: number;
  message: string | null;
  status: DemoRequestStatus;
  createdAt: Date;
};

export function DemoRequestTable({ requests }: { requests: DemoRequestRow[] }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string, next: DemoRequestStatus) {
    startTransition(async () => {
      const result = await setDemoRequestStatusAction(id, next);
      if (result?.error) toast.error(result.error);
      else
        toast.success(
          next === "CONTACTED"
            ? "İletişime geçildi olarak işaretlendi."
            : "Yeni olarak işaretlendi."
        );
    });
  }

  if (requests.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Henüz demo talebi yok.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Yetkili</TableHead>
          <TableHead>Firma</TableHead>
          <TableHead>İletişim</TableHead>
          <TableHead>Araç</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead>Tarih</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">
              {r.fullName}
              {r.message && (
                <p className="text-muted-foreground mt-0.5 max-w-[240px] truncate text-xs font-normal">
                  {r.message}
                </p>
              )}
            </TableCell>
            <TableCell>{r.companyName}</TableCell>
            <TableCell>
              <div className="flex flex-col text-sm">
                <span>{r.email}</span>
                <span className="text-muted-foreground text-xs">{r.phone}</span>
              </div>
            </TableCell>
            <TableCell>{r.vehicleCount}</TableCell>
            <TableCell>
              <Badge variant={demoRequestStatusBadgeVariant[r.status]}>
                {demoRequestStatusLabels[r.status]}
              </Badge>
            </TableCell>
            <TableCell>{formatDateTime(r.createdAt)}</TableCell>
            <TableCell>
              <div className="flex items-center justify-end">
                {r.status === "NEW" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    title="İletişime geçildi olarak işaretle"
                    onClick={() => handleToggle(r.id, "CONTACTED")}
                  >
                    <span className="sr-only">İletişime geçildi</span>
                    <Check />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    title="Yeni olarak işaretle"
                    onClick={() => handleToggle(r.id, "NEW")}
                  >
                    <span className="sr-only">Yeni olarak işaretle</span>
                    <RotateCcw />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
