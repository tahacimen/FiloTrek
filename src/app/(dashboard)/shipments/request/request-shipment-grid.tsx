"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  CheckCircle2,
  Loader2,
  Plus,
  Store,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import {
  createShipmentRequestsAction,
  type ShipmentRequestRow,
} from "@/app/(dashboard)/shipments/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
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

const MARKET = "__market";
const MANUAL = "__manual";

type Row = {
  key: string;
  selected: boolean;
  supplier: string; // supplierId | MARKET | ""
  loadingSource: string; // warehouseId | MANUAL
  manualOrigin: string;
  manualOriginMapsUrl: string;
  consignee: string; // consigneeId | MANUAL
  manualDest: string;
  manualDestMapsUrl: string;
  manualDestProvince: string;
  manualDestDistrict: string;
  tonnage: string;
  km: string;
  expanded: boolean;
  latestLoadingAt: string;
  cargoDescription: string;
  isDangerousGoods: boolean;
  adrClass: string;
  requiresColdChain: boolean;
};

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `row-${keySeq}`;
}

function makeRow(loadingPoints: LoadingPoint[], consignees: Consignee[]): Row {
  return {
    key: nextKey(),
    selected: true,
    supplier: "",
    loadingSource:
      loadingPoints.find((p) => p.isDefault)?.id ??
      loadingPoints[0]?.id ??
      MANUAL,
    manualOrigin: "",
    manualOriginMapsUrl: "",
    consignee: consignees[0]?.id ?? MANUAL,
    manualDest: "",
    manualDestMapsUrl: "",
    manualDestProvince: "",
    manualDestDistrict: "",
    tonnage: "",
    km: "",
    expanded: false,
    latestLoadingAt: "",
    cargoDescription: "",
    isDangerousGoods: false,
    adrClass: "",
    requiresColdChain: false,
  };
}

/**
 * M1: the Excel-like "Araç Çağır" grid. Each row is one request; fill one for
 * a single request or several and bulk-create the selected rows. Advanced
 * fields (en geç yükleme, açıklama, tehlikeli madde, soğuk zincir, belge no)
 * live in a per-row "Detay" panel so the grid stays readable. The old Excel
 * upload flow is gone — this replaces it.
 */
export function RequestShipmentGrid({
  suppliers,
  loadingPoints,
  consignees,
}: {
  suppliers: Company[];
  loadingPoints: LoadingPoint[];
  consignees: Consignee[];
}) {
  const [rows, setRows] = useState<Row[]>(() => [
    makeRow(loadingPoints, consignees),
  ]);
  const [result, setResult] = useState<{
    created: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function patch(key: string, changes: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...changes } : r))
    );
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow(loadingPoints, consignees)]);
  }

  function removeRow(key: string) {
    setRows((prev) =>
      prev.length === 1 ? prev : prev.filter((r) => r.key !== key)
    );
  }

  const selectedCount = rows.filter((r) => r.selected).length;
  const allSelected = rows.length > 0 && rows.every((r) => r.selected);

  /** Resolve a row's dropdown picks into the server's request payload. */
  function toPayload(row: Row): ShipmentRequestRow {
    const point = loadingPoints.find((p) => p.id === row.loadingSource);
    const isManualOrigin = row.loadingSource === MANUAL || !point;
    const originAddress = isManualOrigin
      ? row.manualOrigin.trim()
      : point!.address ?? point!.name;
    const originMapsUrl = isManualOrigin
      ? row.manualOriginMapsUrl.trim() || undefined
      : point!.mapsUrl ?? undefined;

    const cons = consignees.find((c) => c.id === row.consignee);
    const isManualDest = row.consignee === MANUAL || !cons;
    let destinationAddress: string;
    let destinationProvince: string | undefined;
    let destinationDistrict: string | undefined;
    if (!isManualDest && cons) {
      destinationProvince = cons.province;
      destinationDistrict = cons.district;
      destinationAddress = [
        cons.title,
        `${cons.district}/${cons.province}`,
        cons.address ?? "",
      ]
        .filter(Boolean)
        .join(" — ");
    } else {
      destinationProvince = row.manualDestProvince || undefined;
      destinationDistrict = row.manualDestDistrict || undefined;
      destinationAddress = row.manualDest.trim();
    }

    return {
      supplierCompanyId: row.supplier === MARKET ? undefined : row.supplier,
      originAddress,
      originMapsUrl,
      destinationAddress,
      destinationMapsUrl: isManualDest
        ? row.manualDestMapsUrl.trim() || undefined
        : undefined,
      destinationProvince,
      destinationDistrict,
      tonnage: row.tonnage.trim(),
      distanceKm: row.km.trim() || undefined,
      latestLoadingAt: row.latestLoadingAt || undefined,
      cargoDescription: row.cargoDescription.trim() || undefined,
      documentTrackingNumber: undefined,
      isDangerousGoods: row.isDangerousGoods,
      adrClass: row.adrClass.trim() || undefined,
      requiresColdChain: row.requiresColdChain,
    };
  }

  function submit() {
    const chosen = rows.filter((r) => r.selected);
    if (chosen.length === 0) {
      toast.error("En az bir satır seçin.");
      return;
    }
    // Light client-side guard so obvious gaps don't round-trip as errors.
    for (const row of chosen) {
      if (!row.supplier) {
        toast.error("Her satırda tedarikçi seçin (veya Pazara Aç).");
        return;
      }
      if (!row.tonnage.trim()) {
        toast.error("Her satırda tonaj girin.");
        return;
      }
    }

    const payloads = chosen.map(toPayload);
    startTransition(async () => {
      const res = await createShipmentRequestsAction(payloads);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setResult(res);
      if (res.created > 0) {
        toast.success(`${res.created} talep oluşturuldu.`);
      }
      // Drop successfully-created rows: a row errored only if its 1-based
      // position among the submitted set is in the error list.
      if (res.errors.length === 0) {
        setRows([makeRow(loadingPoints, consignees)]);
      } else {
        const erroredPositions = new Set(res.errors.map((e) => e.row));
        setRows((prev) => {
          let pos = 0;
          const kept = prev.filter((r) => {
            if (!r.selected) return true;
            pos += 1;
            return erroredPositions.has(pos);
          });
          return kept.length > 0 ? kept : [makeRow(loadingPoints, consignees)];
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(v) =>
              setRows((prev) => prev.map((r) => ({ ...r, selected: !!v })))
            }
          />
          Tümünü seç ({selectedCount}/{rows.length})
        </label>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus />
          Satır Ekle
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row, idx) => {
          const point = loadingPoints.find((p) => p.id === row.loadingSource);
          const isManualOrigin = row.loadingSource === MANUAL || !point;
          const isManualDest =
            row.consignee === MANUAL ||
            !consignees.find((c) => c.id === row.consignee);
          const isMarket = row.supplier === MARKET;

          return (
            <div
              key={row.key}
              className="flex flex-col gap-3 rounded-lg border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={row.selected}
                    onCheckedChange={(v) =>
                      patch(row.key, { selected: !!v })
                    }
                  />
                  Satır {idx + 1}
                  {isMarket && (
                    <Badge variant="secondary" className="gap-1">
                      <Store className="size-3" />
                      Pazaryeri
                    </Badge>
                  )}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive h-auto px-2 py-1"
                  disabled={rows.length === 1}
                  onClick={() => removeRow(row.key)}
                >
                  <Trash2 />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Tedarikçi / Pazaryeri */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Tedarikçi</Label>
                  <Select
                    value={row.supplier}
                    onValueChange={(v) => patch(row.key, { supplier: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={MARKET}>Pazara Aç (teklif topla)</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Yükleme Noktası */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Yükleme Noktası</Label>
                  <Select
                    value={row.loadingSource}
                    onValueChange={(v) => patch(row.key, { loadingSource: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingPoints.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.isDefault ? " (varsayılan)" : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value={MANUAL}>Başka bir adres…</SelectItem>
                    </SelectContent>
                  </Select>
                  {isManualOrigin && (
                    <Input
                      value={row.manualOrigin}
                      onChange={(e) =>
                        patch(row.key, { manualOrigin: e.target.value })
                      }
                      placeholder="Yükleme adresi"
                    />
                  )}
                </div>

                {/* Teslimat */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Teslimat (Cari)</Label>
                  <Select
                    value={row.consignee}
                    onValueChange={(v) => patch(row.key, { consignee: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {consignees.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title} — {c.district}/{c.province}
                        </SelectItem>
                      ))}
                      <SelectItem value={MANUAL}>Başka bir adres…</SelectItem>
                    </SelectContent>
                  </Select>
                  {isManualDest && (
                    <div className="flex flex-col gap-2">
                      <Input
                        value={row.manualDest}
                        onChange={(e) =>
                          patch(row.key, { manualDest: e.target.value })
                        }
                        placeholder="Teslimat adresi"
                      />
                      <ProvinceDistrictSelect
                        key={`${row.key}-pd`}
                        provinceName={`__p-${row.key}`}
                        districtName={`__d-${row.key}`}
                        defaultProvince={row.manualDestProvince}
                        defaultDistrict={row.manualDestDistrict}
                        onChange={(p, d) =>
                          patch(row.key, {
                            manualDestProvince: p,
                            manualDestDistrict: d,
                          })
                        }
                      />
                    </div>
                  )}
                </div>

                {/* Tonaj + km */}
                <div className="flex gap-2">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label className="text-xs">Tonaj</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row.tonnage}
                      onChange={(e) =>
                        patch(row.key, { tonnage: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label className="text-xs">Km</Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={row.km}
                      onChange={(e) => patch(row.key, { km: e.target.value })}
                      placeholder="oto"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => patch(row.key, { expanded: !row.expanded })}
                className="text-muted-foreground flex w-fit items-center gap-1 text-xs hover:underline"
              >
                <ChevronDown
                  className={`size-3.5 transition-transform ${row.expanded ? "rotate-180" : ""}`}
                />
                Detay (en geç yükleme, açıklama, tehlikeli madde…)
              </button>

              {row.expanded && (
                <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">En Geç Yükleme</Label>
                    <Input
                      type="datetime-local"
                      value={row.latestLoadingAt}
                      onChange={(e) =>
                        patch(row.key, { latestLoadingAt: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Yük Açıklaması</Label>
                    <Textarea
                      rows={1}
                      value={row.cargoDescription}
                      onChange={(e) =>
                        patch(row.key, { cargoDescription: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={row.isDangerousGoods}
                        onCheckedChange={(v) =>
                          patch(row.key, { isDangerousGoods: !!v })
                        }
                      />
                      Tehlikeli Madde (ADR)
                    </label>
                    {row.isDangerousGoods && (
                      <Input
                        value={row.adrClass}
                        onChange={(e) =>
                          patch(row.key, { adrClass: e.target.value })
                        }
                        placeholder="ADR sınıfı (örn. 3)"
                      />
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={row.requiresColdChain}
                      onCheckedChange={(v) =>
                        patch(row.key, { requiresColdChain: !!v })
                      }
                    />
                    Soğuk Zincir
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {result && (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="size-4" />
            {result.created} talep oluşturuldu
            {result.errors.length > 0 &&
              `, ${result.errors.length} satır atlandı`}
            .
          </div>
          {result.errors.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-xs">
              {result.errors.map((e) => (
                <li key={e.row} className="text-destructive">
                  Seçili satır {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={submit} disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <Truck />}
          Talepleri Oluştur ({selectedCount})
        </Button>
      </div>
    </div>
  );
}
