"use client";

import { Plane, Ship, Truck } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  TRANSPORT_MODES,
  transportModeIcon,
  transportModeLabels,
} from "@/lib/transport-mode";
import type { TransportMode } from "@/generated/prisma/enums";

const ICONS = { truck: Truck, ship: Ship, plane: Plane } as const;

/**
 * Clean segmented control for picking a transport mode (Karayolu/Denizyolu/
 * Havayolu). Used at the top of the "Araç Çağır" grid and in the supplier's
 * new-shipment form. Keeps the choice visible and unambiguous rather than
 * buried in a dropdown.
 */
export function TransportModeSelect({
  value,
  onChange,
  size = "md",
}: {
  value: TransportMode;
  onChange: (mode: TransportMode) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="bg-muted inline-flex rounded-lg p-1">
      {TRANSPORT_MODES.map((mode) => {
        const Icon = ICONS[transportModeIcon[mode]];
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
            {transportModeLabels[mode]}
          </button>
        );
      })}
    </div>
  );
}
