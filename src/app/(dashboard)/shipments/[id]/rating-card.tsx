"use client";

import { useActionState, useState } from "react";
import { Loader2, Star } from "lucide-react";

import { rateShipmentAction } from "@/app/(dashboard)/shipments/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function StarRow({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-4",
            n <= score
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Only rendered once the shipment is COMPLETED (see shipments/[id]/page.tsx)
 * — one-directional (customer -> supplier/driver), one rating per shipment.
 */
export function RatingCard({
  shipmentId,
  companyType,
  existingRating,
}: {
  shipmentId: string;
  companyType: "SUPPLIER" | "CUSTOMER";
  existingRating: { score: number; comment: string | null } | null;
}) {
  const action = rateShipmentAction.bind(null, shipmentId);
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [selectedScore, setSelectedScore] = useState(0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Değerlendirme</CardTitle>
      </CardHeader>
      <CardContent>
        {existingRating ? (
          <div className="flex flex-col gap-2">
            <StarRow score={existingRating.score} />
            {existingRating.comment && (
              <p className="text-muted-foreground text-sm">
                {existingRating.comment}
              </p>
            )}
          </div>
        ) : companyType === "CUSTOMER" ? (
          <form action={formAction} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs">Puan</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} yıldız`}
                    onClick={() => setSelectedScore(n)}
                    className="cursor-pointer"
                  >
                    <Star
                      className={cn(
                        "size-6",
                        n <= selectedScore
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                      )}
                    />
                  </button>
                ))}
              </div>
              <input type="hidden" name="score" value={selectedScore} />
            </div>
            <Textarea
              name="comment"
              rows={2}
              placeholder="Yorum (opsiyonel)"
            />
            {state?.error && (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            )}
            <Button
              type="submit"
              disabled={isPending || selectedScore === 0}
              className="self-start"
            >
              {isPending && <Loader2 className="animate-spin" />}
              Değerlendirmeyi Gönder
            </Button>
          </form>
        ) : (
          <p className="text-muted-foreground text-sm">
            Müşteri bu seferi henüz değerlendirmedi.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
