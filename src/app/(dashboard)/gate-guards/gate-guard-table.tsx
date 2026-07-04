"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteGateGuardAction } from "@/app/(dashboard)/gate-guards/actions";
import { GateGuardFormDialog } from "@/app/(dashboard)/gate-guards/gate-guard-form-dialog";
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
import type { SerializableGateGuard } from "@/app/(dashboard)/gate-guards/types";

export function GateGuardTable({
  gateGuards,
}: {
  gateGuards: SerializableGateGuard[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(gateGuard: SerializableGateGuard) {
    if (
      !confirm(
        `${gateGuard.fullName} adlı nizamiye kullanıcısını silmek istediğinize emin misiniz?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteGateGuardAction(gateGuard.id);
      if (result?.error) toast.error(result.error);
      else toast.success("Nizamiye kullanıcısı silindi.");
    });
  }

  if (gateGuards.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Henüz nizamiye kullanıcısı eklenmedi.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ad Soyad</TableHead>
          <TableHead>E-posta</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {gateGuards.map((gateGuard) => (
          <TableRow key={gateGuard.id}>
            <TableCell className="font-medium">{gateGuard.fullName}</TableCell>
            <TableCell>{gateGuard.email}</TableCell>
            <TableCell>
              <Badge variant={gateGuard.isActive ? "success" : "outline"}>
                {gateGuard.isActive ? "Aktif" : "Pasif"}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <GateGuardFormDialog gateGuard={gateGuard} />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => handleDelete(gateGuard)}
                >
                  <span className="sr-only">Sil</span>
                  <Trash2 />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
