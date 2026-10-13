"use client";

import { useActionState } from "react";
import { Loader2, Wallet } from "lucide-react";

import {
  setShipmentPaymentAction,
  type PaymentFormState,
} from "@/app/(dashboard)/shipments/[id]/payment-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  paymentStatusBadgeVariant,
  paymentStatusLabels,
} from "@/lib/labels";
import type { PaymentStatus } from "@/generated/prisma/client";

type Dateish = Date | string | null;

function toDateInput(value: Dateish): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function fmt(value: Dateish): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("tr-TR");
}

export function PaymentCard({
  shipmentId,
  companyType,
  paymentStatus,
  paymentDueDate,
  paidAt,
}: {
  shipmentId: string;
  companyType: "SUPPLIER" | "CUSTOMER";
  paymentStatus: PaymentStatus;
  paymentDueDate: Dateish;
  paidAt: Dateish;
}) {
  const [state, formAction, isPending] = useActionState<
    PaymentFormState,
    FormData
  >(setShipmentPaymentAction.bind(null, shipmentId), undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="text-muted-foreground size-4" />
          Ödeme
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Durum</span>
          <Badge variant={paymentStatusBadgeVariant[paymentStatus]}>
            {paymentStatusLabels[paymentStatus]}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Vade tarihi</span>
          <span className="font-medium">{fmt(paymentDueDate)}</span>
        </div>
        {paidAt && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ödeme alındı</span>
            <span className="font-medium">{fmt(paidAt)}</span>
          </div>
        )}

        {companyType === "SUPPLIER" ? (
          <form action={formAction} className="mt-1 flex flex-col gap-3 border-t pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="status" className="text-xs">
                  Durum
                </Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={paymentStatus}
                  className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="PENDING">Ödeme Bekliyor</option>
                  <option value="PAID">Ödendi</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dueDate" className="text-xs">
                  Vade tarihi
                </Label>
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  defaultValue={toDateInput(paymentDueDate)}
                />
              </div>
            </div>
            {state?.error && (
              <p className="text-destructive text-sm" role="alert">
                {state.error}
              </p>
            )}
            <Button type="submit" size="sm" disabled={isPending} className="self-start">
              {isPending && <Loader2 className="animate-spin" />}
              Kaydet
            </Button>
          </form>
        ) : (
          <p className="text-muted-foreground border-t pt-3 text-xs">
            Ödeme durumunu tedarikçiniz günceller.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
