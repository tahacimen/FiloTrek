"use client";

import { useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";

import { setDefaultWarehouseAction } from "@/app/(dashboard)/warehouses/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DefaultWarehouseControl({
  warehouseId,
  isDefault,
}: {
  warehouseId: string;
  isDefault: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (isDefault) {
    return (
      <Badge variant="success" className="gap-1">
        <Star className="size-3" />
        Varsayılan Yükleme Noktası
      </Badge>
    );
  }

  function handleSetDefault() {
    startTransition(async () => {
      const result = await setDefaultWarehouseAction(warehouseId);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={handleSetDefault}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <Star />}
      Varsayılan Yap
    </Button>
  );
}
