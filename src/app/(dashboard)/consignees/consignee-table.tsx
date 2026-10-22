"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { removeConsigneeAction } from "@/app/(dashboard)/consignees/actions";
import {
  ConsigneeFormDialog,
  type ConsigneeDTO,
} from "@/app/(dashboard)/consignees/consignee-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ConsigneeTable({ consignees }: { consignees: ConsigneeDTO[] }) {
  const [isPending, startTransition] = useTransition();

  function handleRemove(c: ConsigneeDTO) {
    if (!confirm(`${c.title} carisini silmek istediğinize emin misiniz?`)) return;
    startTransition(async () => {
      const result = await removeConsigneeAction(c.id);
      if (result?.error) toast.error(result.error);
      else toast.success("Cari silindi.");
    });
  }

  if (consignees.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Henüz cari eklenmedi. Teslim noktalarınızı buraya ekleyin.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ünvan</TableHead>
          <TableHead>İl / İlçe</TableHead>
          <TableHead>Telefon</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {consignees.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">{c.title}</TableCell>
            <TableCell>
              {c.province} / {c.district}
            </TableCell>
            <TableCell>{c.phone ?? "—"}</TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <ConsigneeFormDialog consignee={c} />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => handleRemove(c)}
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
