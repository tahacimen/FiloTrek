"use client";

import { useActionState, useState, useTransition } from "react";
import { Calculator, Loader2, Truck } from "lucide-react";

import {
  createShipmentRequestAction,
  estimateDistanceKmAction,
  type ShipmentFormState,
} from "@/app/(dashboard)/shipments/actions";
import { DangerousGoodsFields } from "@/app/(dashboard)/shipments/dangerous-goods-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProvinceDistrictSelect } from "@/components/province-district-select";
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

type Consignee = {
  id: string;
  title: string;
  province: string;
  district: string;
  address: string | null;
};

const MANUAL_LOADING_POINT = "manual";
const MANUAL_CONSIGNEE = "manual";

export function RequestShipmentForm({
  suppliers,
  loadingPoints,
  consignees,
}: {
  suppliers: Company[];
  loadingPoints: LoadingPoint[];
  consignees: Consignee[];
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
  const isManualLoading = loadingSource === MANUAL_LOADING_POINT || !selectedPoint;
  const [manualOrigin, setManualOrigin] = useState("");

  // Delivery point: pick a saved cari (auto-fills il/ilçe) or type an address.
  const [consigneeId, setConsigneeId] = useState<string>(
    consignees[0]?.id ?? MANUAL_CONSIGNEE
  );
  const selectedConsignee = consignees.find((c) => c.id === consigneeId);
  const isManualDest = consigneeId === MANUAL_CONSIGNEE || !selectedConsignee;
  const [manualDest, setManualDest] = useState("");
  const [manualDestProvince, setManualDestProvince] = useState("");
  const [manualDestDistrict, setManualDestDistrict] = useState("");

  // C2: auto-computed km (editable). Empty until computed or typed.
  const [km, setKm] = useState("");
  const [kmPending, startKm] = useTransition();
  const [kmInfo, setKmInfo] = useState<string | null>(null);

  function originQuery(): string {
    if (isManualLoading) return manualOrigin.trim();
    return (selectedPoint?.address ?? selectedPoint?.name ?? "").trim();
  }
  function destinationQuery(): string {
    if (!isManualDest && selectedConsignee) {
      return `${selectedConsignee.district} ${selectedConsignee.province}`;
    }
    if (manualDestProvince && manualDestDistrict) {
      return `${manualDestDistrict} ${manualDestProvince}`;
    }
    return manualDest.trim();
  }

  function recalcDistance() {
    const o = originQuery();
    const d = destinationQuery();
    if (!o || !d) return;
    setKmInfo(null);
    startKm(async () => {
      const { km: result } = await estimateDistanceKmAction(o, d);
      if (result != null) {
        setKm(String(result));
        setKmInfo("Google/OSRM üzerinden otomatik hesaplandı — gerekirse düzenleyebilirsiniz.");
      } else {
        setKmInfo("Mesafe otomatik hesaplanamadı. Lütfen km değerini elle girin.");
      }
    });
  }

  // The destinationAddress stored on the shipment: a readable composite for the
  // chosen cari, or the typed address.
  const destinationAddressValue =
    !isManualDest && selectedConsignee
      ? [
          selectedConsignee.title,
          `${selectedConsignee.district}/${selectedConsignee.province}`,
          selectedConsignee.address ?? "",
        ]
          .filter(Boolean)
          .join(" — ")
      : manualDest;

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
          <Select
            value={loadingSource}
            onValueChange={(v) => {
              setLoadingSource(v);
              // recalc after the source changes (next tick via state read).
              setTimeout(recalcDistance, 0);
            }}
          >
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

        {isManualLoading ? (
          <div className="flex flex-col gap-3">
            <Input
              id="originAddress"
              name="originAddress"
              required
              value={manualOrigin}
              onChange={(e) => setManualOrigin(e.target.value)}
              onBlur={recalcDistance}
              placeholder="Yükleme adresi (örn. İstanbul, Tuzla OSB)"
            />
            <Input
              name="originMapsUrl"
              type="url"
              placeholder="Google Maps linki (opsiyonel)"
            />
          </div>
        ) : (
          <div className="bg-muted/40 rounded-lg border p-3 text-sm">
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
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="consigneeSource">Teslimat Noktası (Cari)</Label>
        {consignees.length > 0 && (
          <Select
            value={consigneeId}
            onValueChange={(v) => {
              setConsigneeId(v);
              setTimeout(recalcDistance, 0);
            }}
          >
            <SelectTrigger id="consigneeSource" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {consignees.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title} — {c.district}/{c.province}
                </SelectItem>
              ))}
              <SelectItem value={MANUAL_CONSIGNEE}>Başka bir adres gir…</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* The destination address + province/district that travel with the
            shipment, whichever mode is active. */}
        <input type="hidden" name="destinationAddress" value={destinationAddressValue} />
        <input
          type="hidden"
          name="destinationProvince"
          value={isManualDest ? manualDestProvince : selectedConsignee?.province ?? ""}
        />
        <input
          type="hidden"
          name="destinationDistrict"
          value={isManualDest ? manualDestDistrict : selectedConsignee?.district ?? ""}
        />

        {isManualDest ? (
          <div className="flex flex-col gap-3">
            <Input
              name="destinationMapsUrl"
              type="url"
              placeholder="Teslimat Google Maps linki (opsiyonel)"
            />
            <Input
              required
              value={manualDest}
              onChange={(e) => setManualDest(e.target.value)}
              onBlur={recalcDistance}
              placeholder="Teslimat adresi (örn. İzmir, Kemalpaşa OSB)"
            />
            <ProvinceDistrictSelect
              provinceName="__destProvincePicker"
              districtName="__destDistrictPicker"
              defaultProvince={manualDestProvince}
              defaultDistrict={manualDestDistrict}
              onChange={(p, d) => {
                setManualDestProvince(p);
                setManualDestDistrict(d);
                if (p && d) setTimeout(recalcDistance, 0);
              }}
            />
            {consignees.length === 0 && (
              <p className="text-muted-foreground text-xs">
                İpucu: sık teslim ettiğiniz carileri{" "}
                <span className="font-medium">Cariler</span> sayfasından kaydedip
                burada hazır seçebilirsiniz (il/ilçe otomatik gelir).
              </p>
            )}
          </div>
        ) : (
          <div className="bg-muted/40 rounded-lg border p-3 text-sm">
            <p className="font-medium">{selectedConsignee!.title}</p>
            <p className="text-muted-foreground">
              {selectedConsignee!.district} / {selectedConsignee!.province}
              {selectedConsignee!.address ? ` — ${selectedConsignee!.address}` : ""}
            </p>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="distanceKm">Mesafe (km)</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={recalcDistance}
            disabled={kmPending}
          >
            {kmPending ? <Loader2 className="animate-spin" /> : <Calculator />}
            Otomatik Hesapla
          </Button>
        </div>
        <Input
          id="distanceKm"
          name="distanceKm"
          type="number"
          step="1"
          min="0"
          required
          value={km}
          onChange={(e) => setKm(e.target.value)}
          placeholder="Yükleme ve teslim noktası seçilince otomatik hesaplanır"
        />
        {kmInfo && <p className="text-muted-foreground text-xs">{kmInfo}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tonnage">Tonaj (ton)</Label>
        <Input id="tonnage" name="tonnage" type="number" step="0.1" min="0" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="latestLoadingAt">En Geç Yükleme Tarih/Saati (opsiyonel)</Label>
        <Input
          id="latestLoadingAt"
          name="latestLoadingAt"
          type="datetime-local"
        />
        <p className="text-muted-foreground text-xs">
          Yükün en geç ne zaman alınması gerektiği — şoföre iletilir. Nakliyeci de
          sonradan güncelleyebilir.
        </p>
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
