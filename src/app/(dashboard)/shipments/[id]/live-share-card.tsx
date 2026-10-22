"use client";

import { useState, useTransition } from "react";
import { Copy, Loader2, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";

import { getLiveTrackingLinkAction } from "@/app/(dashboard)/shipments/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ShipmentStatus } from "@/generated/prisma/enums";

/**
 * N5: share the shipment's unguessable live-tracking link. Shown to both
 * parties once a supplier is assigned and the shipment isn't cancelled. The
 * token is minted on first click (getLiveTrackingLinkAction), then offered as
 * copy / WhatsApp.
 */
export function LiveShareCard({
  shipmentId,
  hasSupplier,
  status,
}: {
  shipmentId: string;
  hasSupplier: boolean;
  status: ShipmentStatus;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!hasSupplier || status === "CANCELLED") return null;

  function loadLink() {
    if (url) return;
    startTransition(async () => {
      const result = await getLiveTrackingLinkAction(shipmentId);
      if ("error" in result) toast.error(result.error);
      else setUrl(result.url);
    });
  }

  const waHref = url
    ? `https://wa.me/?text=${encodeURIComponent(
        `Sevkiyatınızın canlı takibi: ${url}`
      )}`
    : "#";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Share2 className="text-muted-foreground size-4" />
          Canlı Takip Linki
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          Aracın anlık konumunu gösteren, giriş gerektirmeyen bağlantıyı
          müşteriniz/alıcı ile paylaşın.
        </p>
        {url ? (
          <>
            <input
              readOnly
              value={url}
              className="border-input bg-muted/40 rounded-lg border p-2.5 text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  navigator.clipboard
                    .writeText(url)
                    .then(() => toast.success("Link kopyalandı."))
                    .catch(() => toast.error("Kopyalanamadı."))
                }
              >
                <Copy />
                Kopyala
              </Button>
              <Button asChild className="bg-[#25D366] text-white hover:bg-[#1eb955]">
                <a href={waHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle />
                  WhatsApp
                </a>
              </Button>
            </div>
          </>
        ) : (
          <Button className="w-fit" onClick={loadLink} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <Share2 />}
            Linki Oluştur
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
