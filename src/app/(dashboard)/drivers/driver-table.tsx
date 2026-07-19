"use client";

import { useTransition } from "react";
import { Link2Off, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteDriverAction,
  revokeDriverLoginLinkAction,
} from "@/app/(dashboard)/drivers/actions";
import { DriverFormDialog } from "@/app/(dashboard)/drivers/driver-form-dialog";
import { DriverShareDialog } from "@/app/(dashboard)/drivers/driver-share-dialog";
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
import { driverStatusLabels, statusBadgeVariant } from "@/lib/labels";
import type { SerializableDriver } from "@/app/(dashboard)/drivers/types";

export function DriverTable({ drivers }: { drivers: SerializableDriver[] }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(driver: SerializableDriver) {
    if (!confirm(`${driver.fullName} adlı şoförü silmek istediğinize emin misiniz?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteDriverAction(driver.id);
      if (result?.error) toast.error(result.error);
      else toast.success("Şoför silindi.");
    });
  }

  function handleRevokeLoginLink(driver: SerializableDriver) {
    if (
      !confirm(
        `${driver.fullName} adlı şoförün giriş bağlantısını iptal etmek istediğinize emin misiniz? Şoför yeni bir bağlantı gönderilene kadar bu yolla giriş yapamayacak.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await revokeDriverLoginLinkAction(driver.id);
      if (result?.error) toast.error(result.error);
      else toast.success(`${driver.fullName} adlı şoförün giriş bağlantısı iptal edildi.`);
    });
  }

  if (drivers.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Henüz şoför eklenmedi.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ad Soyad</TableHead>
          <TableHead>Telefon</TableHead>
          <TableHead>Ehliyet No</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead>Giriş</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {drivers.map((driver) => (
          <TableRow key={driver.id}>
            <TableCell className="font-medium">{driver.fullName}</TableCell>
            <TableCell>{driver.phone}</TableCell>
            <TableCell>{driver.licenseNumber}</TableCell>
            <TableCell>
              <Badge variant={statusBadgeVariant[driver.status]}>
                {driverStatusLabels[driver.status]}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={driver.hasActiveLoginLink ? "success" : "outline"}>
                {driver.hasActiveLoginLink ? "Bağlantı Aktif" : "Bağlantı Yok"}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <DriverFormDialog driver={driver} />
                <DriverShareDialog driver={driver} />
                {driver.hasActiveLoginLink && (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    title="Giriş Bağlantısını İptal Et"
                    onClick={() => handleRevokeLoginLink(driver)}
                  >
                    <span className="sr-only">Giriş Bağlantısını İptal Et</span>
                    <Link2Off />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending || driver.status === "ON_TRIP"}
                  onClick={() => handleDelete(driver)}
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
