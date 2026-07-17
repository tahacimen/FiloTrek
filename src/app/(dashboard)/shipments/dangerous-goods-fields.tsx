"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Collapsed by default so it doesn't clutter the common case — most
 * shipments are neither dangerous goods nor cold chain. Renders plain
 * hidden inputs for the two checkboxes (rather than relying on a native
 * checkbox's on/absent FormData behavior) since this is a controlled
 * component that also toggles the conditional sub-fields below each one.
 */
export function DangerousGoodsFields() {
  const [open, setOpen] = useState(false);
  const [isDangerousGoods, setIsDangerousGoods] = useState(false);
  const [requiresColdChain, setRequiresColdChain] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium"
      >
        {open ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        Özel Yük Bilgileri (opsiyonel)
      </button>

      {open && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="isDangerousGoods"
                checked={isDangerousGoods}
                onCheckedChange={(checked) =>
                  setIsDangerousGoods(checked === true)
                }
              />
              <Label htmlFor="isDangerousGoods" className="font-normal">
                Tehlikeli madde / ADR
              </Label>
            </div>
            {isDangerousGoods && (
              <div className="flex flex-col gap-2 pl-6">
                <Label htmlFor="adrClass">ADR Sınıfı</Label>
                <Input
                  id="adrClass"
                  name="adrClass"
                  placeholder="Örn. Sınıf 3 - Yanıcı Sıvılar"
                />
              </div>
            )}
          </div>
          <input
            type="hidden"
            name="isDangerousGoods"
            value={isDangerousGoods ? "true" : ""}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="requiresColdChain"
                checked={requiresColdChain}
                onCheckedChange={(checked) =>
                  setRequiresColdChain(checked === true)
                }
              />
              <Label htmlFor="requiresColdChain" className="font-normal">
                Soğuk zincir gerekli
              </Label>
            </div>
            {requiresColdChain && (
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="temperatureMinC">Min Sıcaklık (°C)</Label>
                  <Input
                    id="temperatureMinC"
                    name="temperatureMinC"
                    type="number"
                    step="0.1"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="temperatureMaxC">Maks Sıcaklık (°C)</Label>
                  <Input
                    id="temperatureMaxC"
                    name="temperatureMaxC"
                    type="number"
                    step="0.1"
                  />
                </div>
              </div>
            )}
          </div>
          <input
            type="hidden"
            name="requiresColdChain"
            value={requiresColdChain ? "true" : ""}
          />
        </div>
      )}
    </div>
  );
}
