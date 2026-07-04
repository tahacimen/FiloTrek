"use client";

import { useTransition } from "react";
import { LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";

import { logGateEventAction } from "@/app/(gate)/gate/actions";
import { Button } from "@/components/ui/button";
import { GateEventType } from "@/generated/prisma/enums";

export function GateEventActions({
  shipmentId,
  isInside,
  isDone,
}: {
  shipmentId: string;
  isInside: boolean;
  isDone: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick(eventType: GateEventType) {
    const confirmMessage =
      eventType === GateEventType.VEHICLE_ENTERED
        ? "Aracın giriş yaptığını kaydetmek istediğinize emin misiniz?"
        : "Aracın çıkış yaptığını kaydetmek istediğinize emin misiniz?";
    if (!confirm(confirmMessage)) return;

    startTransition(async () => {
      const result = await logGateEventAction(shipmentId, eventType);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          eventType === GateEventType.VEHICLE_ENTERED
            ? "Araç girişi kaydedildi."
            : "Araç çıkışı kaydedildi."
        );
      }
    });
  }

  return isInside ? (
    <Button
      onClick={() => handleClick(GateEventType.VEHICLE_EXITED)}
      disabled={isPending}
      variant="outline"
    >
      <LogOut />
      Araç Çıkış Yaptı
    </Button>
  ) : (
    <Button
      onClick={() => handleClick(GateEventType.VEHICLE_ENTERED)}
      disabled={isPending || isDone}
    >
      <LogIn />
      Araç Giriş Yaptı
    </Button>
  );
}
