"use client";

import { useState } from "react";
import { Copy, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import {
  notifyDriverWhatsAppAction,
  type NotifyDriverResult,
} from "@/app/(dashboard)/shipments/[id]/notify-driver-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ShipmentStatus } from "@/generated/prisma/enums";

/** TR phone → wa.me format (digits, country code, no leading 0 / no +). */
function toWhatsAppPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  return `90${digits}`;
}

/**
 * Supplier-only prompt shown once the price is approved and a driver is
 * assigned: a one-tap WhatsApp handoff to that driver (free — the dispatcher
 * taps send). Renders nothing when it doesn't apply. Not shown after the
 * shipment is finished/cancelled — nothing left to dispatch.
 */
export function NotifyDriverCard({
  shipmentId,
  companyType,
  hasDriver,
  priceApproved,
  status,
}: {
  shipmentId: string;
  companyType: "SUPPLIER" | "CUSTOMER";
  hasDriver: boolean;
  priceApproved: boolean;
  status: ShipmentStatus;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Exclude<NotifyDriverResult, { error: string }> | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  if (
    companyType !== "SUPPLIER" ||
    !hasDriver ||
    !priceApproved ||
    status === "COMPLETED" ||
    status === "CANCELLED"
  ) {
    return null;
  }

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && !data) {
      setLoading(true);
      const result = await notifyDriverWhatsAppAction(shipmentId);
      setLoading(false);
      if ("error" in result) {
        toast.error(result.error);
        setOpen(false);
        return;
      }
      setData(result);
    }
  }

  const waHref = data
    ? `https://wa.me/${toWhatsAppPhone(data.phone)}?text=${encodeURIComponent(data.message)}`
    : "#";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="text-muted-foreground size-4" />
          Şoför Bildirimi
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          Fiyat onaylandı. Şoföre seferi ve yol tarifini WhatsApp&apos;tan tek
          tıkla iletin.
        </p>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogTrigger asChild>
            <Button className="w-fit bg-[#25D366] text-white hover:bg-[#1eb955]">
              <MessageCircle />
              Şoföre WhatsApp&apos;tan Haber Ver
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Şoföre WhatsApp&apos;tan Haber Ver</DialogTitle>
              <DialogDescription>
                Mesaj hazır. &quot;WhatsApp&apos;tan Gönder&quot;e basınca
                WhatsApp açılır; onaylayıp gönderin.
              </DialogDescription>
            </DialogHeader>
            {loading || !data ? (
              <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Hazırlanıyor…
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <textarea
                  readOnly
                  rows={5}
                  value={data.message}
                  className="border-input bg-muted/40 resize-none rounded-lg border p-3 text-sm"
                />
                <Button
                  asChild
                  className="bg-[#25D366] text-white hover:bg-[#1eb955]"
                >
                  <a href={waHref} target="_blank" rel="noopener noreferrer">
                    <MessageCircle />
                    WhatsApp&apos;tan Gönder
                  </a>
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(data.message)
                      .then(() => toast.success("Mesaj kopyalandı."))
                      .catch(() => toast.error("Kopyalanamadı."))
                  }
                >
                  <Copy />
                  Mesajı Kopyala
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
