"use client";

import { useTransition } from "react";
import { Copy, Trash2, Truck, Building2 } from "lucide-react";
import { toast } from "sonner";

import { revokeDemoInstanceAction } from "@/app/(dashboard)/admin/actions";
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

export type DemoInstanceRow = {
  id: string;
  customerLabel: string;
  supplierUrl: string;
  customerUrl: string;
  expiresAt: Date;
  createdAt: Date;
  expired: boolean;
};

function LinkCell({
  icon,
  label,
  url,
}: {
  icon: React.ReactNode;
  label: string;
  url: string;
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} bağlantısı kopyalandı.`);
    } catch {
      toast.error("Kopyalanamadı — bağlantıyı elle seçip kopyalayın.");
    }
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground flex w-24 shrink-0 items-center gap-1.5 text-xs font-medium">
        {icon}
        {label}
      </span>
      <code className="bg-muted max-w-[280px] truncate rounded px-2 py-1 text-xs">
        {url}
      </code>
      <Button variant="ghost" size="icon" title="Kopyala" onClick={copy}>
        <Copy className="size-4" />
      </Button>
    </div>
  );
}

export function DemoInstanceTable({
  instances,
}: {
  instances: DemoInstanceRow[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleRevoke(id: string) {
    startTransition(async () => {
      const result = await revokeDemoInstanceAction(id);
      if (result?.error) toast.error(result.error);
      else toast.success("Demo ortamı iptal edildi ve temizlendi.");
    });
  }

  if (instances.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Aktif demo ortamı yok. Bir demo talebinde “Demo Erişimi Oluştur” ile
        başlatın.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Firma</TableHead>
          <TableHead>Giriş Bağlantıları</TableHead>
          <TableHead>Geçerlilik</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {instances.map((i) => (
          <TableRow key={i.id}>
            <TableCell className="align-top font-medium">
              {i.customerLabel}
              <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                {formatDateTime(i.createdAt)}
              </p>
            </TableCell>
            <TableCell className="align-top">
              <div className="flex flex-col gap-1.5">
                <LinkCell
                  icon={<Truck className="size-3.5" />}
                  label="Tedarikçi"
                  url={i.supplierUrl}
                />
                <LinkCell
                  icon={<Building2 className="size-3.5" />}
                  label="Müşteri"
                  url={i.customerUrl}
                />
              </div>
            </TableCell>
            <TableCell className="align-top text-sm">
              {i.expired ? (
                <span className="text-destructive font-medium">Süresi doldu</span>
              ) : (
                <>
                  <span className="font-medium">{formatDateTime(i.expiresAt)}</span>
                  <p className="text-muted-foreground text-xs">bitiş</p>
                </>
              )}
            </TableCell>
            <TableCell className="align-top">
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                title="İptal et ve temizle"
                onClick={() => handleRevoke(i.id)}
              >
                <span className="sr-only">İptal et</span>
                <Trash2 className="text-destructive size-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
