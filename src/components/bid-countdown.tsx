"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

import { formatCountdown, msUntilDeadline } from "@/lib/bid";

/**
 * Live countdown to a shipment's bidding deadline. Ticks every 30s (the label
 * is minute-granular) and flips to a "closed" state once the deadline passes.
 */
export function BidCountdown({
  deadline,
  className = "",
}: {
  deadline: string;
  className?: string;
}) {
  const [ms, setMs] = useState<number>(() => {
    const t = new Date(deadline);
    return msUntilDeadline(t) ?? 0;
  });

  useEffect(() => {
    const t = new Date(deadline);
    const tick = () => setMs(msUntilDeadline(t) ?? 0);
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [deadline]);

  const closed = ms <= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        closed ? "text-destructive" : "text-amber-600"
      } ${className}`}
    >
      <Clock className="size-3.5" />
      {closed ? "Teklif toplama kapandı" : `Teklife ${formatCountdown(ms)} kaldı`}
    </span>
  );
}
