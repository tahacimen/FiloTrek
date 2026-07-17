"use client";

import { useActionState, useState } from "react";
import { Loader2, Truck } from "lucide-react";

import {
  createShipmentRequestAction,
  type ShipmentFormState,
} from "@/app/(dashboard)/shipments/actions";
import { DangerousGoodsFields } from "@/app/(dashboard)/shipments/dangerous-goods-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { confirmSubmit } from "@/lib/confirm-submit";
import type { Company } from "@/generated/prisma/client";

type LoadingPoint = {
  id: string;
  name: string;
  address: string | null;
  mapsUrl: string | null;
  isDefault: boolean;
};

const MANUAL_LOADING_POINT = "manual";

export function RequestShipmentForm({
  suppliers,
  loadingPoints,
}: {
  suppliers: Company[];
  loadingPoints: LoadingPoint[];
}) {
  const [state, formAction, isPending] = useActionState<
    ShipmentFormState,
    FormData
  >(createShipmentRequestAction, undefined);
  const [mode, setMode] = useState<"specific" | "market">("specific");

  // Pre-select the default loading point (or the first saved one) so the
  // customer doesn't re-type the pickup address every time; fall back to
  // manual entry when there are no saved warehouses at all.
  const [loadingSource, setLoadingSource] = useState<string>(
    loadingPoints.find((p) => p.isDefault)?.id ??
      loadingPoints[0]?.id ??
      MANUAL_LOADING_POINT
  );
  const selectedPoint = loadingPoints.find((p) => p.id === loadingSource);
  const isManual = loadingSource === MANUAL_LOADING_POINT || !selectedPoint;

  return (
    <form
      action={formAction}
      onSubmit={confirmSubmit(
        mode === "specific"
          ? "Araç çağırmak istediğinize emin misiniz?"
          : "Bu seferi pazara açıp tedarikçilerden teklif toplamak istediğinize emin misiniz?"
      )}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label>Nasıl bir tedarikçi bulmak istiyorsunuz?</Label>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "specific" | "market")}>
          <TabsList>
            <TabsTrigger value="specific">Belirli Bir Tedarikçiye Gönder</TabsTrigger>
            <TabsTrigger value="market">Pazara Aç, Teklif Topla</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {mode === "specific" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="supplierCompanyId">Tedarikçi Firma</Label>
          <Select name="supplierCompanyId" required>
            <SelectTrigger id="supplierCompanyId" className="w-full">
              <SelectValue placeholder="Bir tedarikçi seçin" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Bu sefer, kayıtlı tüm tedarikçilerin görüp teklif verebileceği açık
          pazara eklenecek — istediğiniz teklifi kabul edersiniz.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="loadingSource">Yükleme Noktası</Label>
        {loadingPoints.length > 0 && (
          <Select value={loadingSource} onValueChange={setLoadingSource}>
            <SelectTrigger id="loadingSource" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {loadingPoints.map((point) => (
                <SelectItem key={point.id} value={point.id}>
                  {point.name}
                  {point.address ? ` — ${point.address}` : ""}
                  {point.isDefault ? " (varsayılan)" : ""}
                </SelectItem>
              ))}
              <SelectItem value={MANUAL_LOADING_POINT}>
                Başka bir adres gir…
              </SelectItem>
            </SelectContent>
          </Select>
        )}

        {isManual ? (
          <div className="flex flex-col gap-3">
            <Input
              id="originAddress"
              name="originAddress"
              required
              placeholder="Yükleme adresi (örn. İstanbul, Tuzla OSB)"
            />
            <Input
              name="originMapsUrl"
              type="url"
              placeholder="Google Maps linki (opsiyonel)"
            />
            {loadingPoints.length === 0 && (
              <p className="text-muted-foreground text-xs">
                İpucu: sık kullandığınız yükleme noktalarını{" "}
                <span className="font-medium">Depo &amp; Rampa</span>{" "}
                sayfasından kaydedip burada hazır seçebilirsiniz.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-muted/40 rounded-lg border p-3 text-sm">
            {/* Selected saved warehouse — its address + link travel with the
                shipment via these hidden inputs, so the pickup point isn't
                re-typed. */}
            <input
              type="hidden"
              name="originAddress"
              value={selectedPoint!.address ?? selectedPoint!.name}
            />
            <input
              type="hidden"
              name="originMapsUrl"
              value={selectedPoint!.mapsUrl ?? ""}
            />
            <p className="font-medium">{selectedPoint!.name}</p>
            {selectedPoint!.address && (
              <p className="text-muted-foreground">{selectedPoint!.address}</p>
            )}
            {selectedPoint!.mapsUrl && (
              <a
                href={selectedPoint!.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Haritada Gör
              </a>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="destinationAddress">Teslimat Noktası</Label>
        <Input
          id="destinationAddress"
          name="destinationAddress"
          required
          placeholder="Teslimat adresi (örn. İzmir)"
        />
        <Input
          name="destinationMapsUrl"
          type="url"
          placeholder="Teslimat Google Maps linki (opsiyonel)"
        />
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="distanceKm">Mesafe (km)</Label>
          <Input
            id="distanceKm"
            name="distanceKm"
            type="number"
            step="1"
            min="0"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tonnage">Tonaj (ton)</Label>
          <Input
            id="tonnage"
            name="tonnage"
            type="number"
            step="0.1"
            min="0"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="documentTrackingNumber">
          Belge Takip Numarası (opsiyonel)
        </Label>
        <Input
          id="documentTrackingNumber"
          name="documentTrackingNumber"
          placeholder="İrsaliye/fatura süreciyle eşleştirmek için"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cargoDescription">Yük Açıklaması (opsiyonel)</Label>
        <Textarea id="cargoDescription" name="cargoDescription" rows={3} />
      </div>

      <DangerousGoodsFields />

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? <Loader2 className="animate-spin" /> : <Truck />}
        {mode === "specific" ? "Araç Çağır" : "Pazara Aç"}
      </Button>
    </form>
  );
}
