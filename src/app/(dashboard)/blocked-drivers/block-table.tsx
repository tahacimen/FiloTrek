"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { removeDriverBlockAction } from "@/app/(dashboard)/blocked-drivers/actions";
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

export type BlockRow = {
  id: string;
  fullName: string | null;
  tcNumber: string | null;
  licenseNumber: string | null;
  reason: string | null;
  createdAt: Date;
};

export function BlockTable({ blocks }: { blocks: BlockRow[] }) {
  const [isPending, startTransition] = useTransition();

  function handleRemove(id: string) {
    if (!confirm("Bu engeli kaldırmak istediğinize emin misiniz?")) return;
    startTransition(async () => {
      const result = await removeDriverBlockAction(id);
      if (result?.error) toast.error(result.error);
      else toast.success("Engel kaldırıldı.");
    });
  }

  if (blocks.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Henüz engellenen sürücü yok.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ad Soyad</TableHead>
          <TableHead>TC Kimlik</TableHead>
          <TableHead>Ehliyet No</TableHead>
          <TableHead>Açıklama</TableHead>
          <TableHead>Tarih</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {blocks.map((b) => (
          <TableRow key={b.id}>
            <TableCell className="font-medium">{b.fullName ?? "—"}</TableCell>
            <TableCell>{b.tcNumber ?? "—"}</TableCell>
            <TableCell>{b.licenseNumber ?? "—"}</TableCell>
            <TableCell className="max-w-[260px] truncate">
              {b.reason ?? "—"}
            </TableCell>
            <TableCell>{formatDateTime(b.createdAt)}</TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                title="Engeli kaldır"
                onClick={() => handleRemove(b.id)}
              >
                <span className="sr-only">Engeli kaldır</span>
                <Trash2 className="text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
