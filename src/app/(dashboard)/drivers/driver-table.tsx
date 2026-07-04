"use client";

import { useTransition } from "react";
import { Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteDriverAction,
  sendDriverLoginLinkAction,
} from "@/app/(dashboard)/drivers/actions";
import { DriverFormDialog } from "@/app/(dashboard)/drivers/driver-form-dialog";
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

  function handleSendLoginLink(driver: SerializableDriver) {
    if (
      !confirm(
        `${driver.fullName} adlı şoföre giriş bağlantısı göndermek istediğinize emin misiniz?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await sendDriverLoginLinkAction(driver.id);
      if (result?.error) toast.error(result.error);
      else toast.success(`${driver.fullName} adlı şoföre giriş bağlantısı gönderildi.`);
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
              <Badge variant={driver.email ? "success" : "outline"}>
                {driver.email ? "Var" : "Yok"}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <DriverFormDialog driver={driver} />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending || !driver.email}
                  title={
                    driver.email
                      ? "Giriş Bağlantısı Gönder"
                      : "Bağlantı gönderebilmek için önce e-posta tanımlanmalı"
                  }
                  onClick={() => handleSendLoginLink(driver)}
                >
                  <span className="sr-only">Giriş Bağlantısı Gönder</span>
                  <Link2 />
                </Button>
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
