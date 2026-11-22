import { LoadType, TransportMode } from "@/generated/prisma/enums";
import {
  customerShipmentStatusLabels,
  shipmentStatusLabels,
} from "@/lib/labels";
import type { ShipmentStatus } from "@/generated/prisma/enums";

/**
 * Multimodal: everything mode-specific lives here so the rest of the app can
 * stay mode-agnostic. Client-safe (only the generated enum types + the base
 * label maps, which themselves import only enums). ROAD is the default and the
 * only mode with company-owned vehicle+driver assignment and the dock/gate
 * flow; SEA/AIR carry a free-text carrier plus their own reference numbers and
 * reuse the same status sequence with reworded labels.
 */

export const transportModeLabels: Record<TransportMode, string> = {
  [TransportMode.ROAD]: "Karayolu",
  [TransportMode.SEA]: "Denizyolu",
  [TransportMode.AIR]: "Havayolu",
};

/** Short icon key per mode — components map this to a lucide icon (keeps this file React-free). */
export const transportModeIcon: Record<TransportMode, "truck" | "ship" | "plane"> = {
  [TransportMode.ROAD]: "truck",
  [TransportMode.SEA]: "ship",
  [TransportMode.AIR]: "plane",
};

export const TRANSPORT_MODES: TransportMode[] = [
  TransportMode.ROAD,
  TransportMode.SEA,
  TransportMode.AIR,
];

export const loadTypeLabels: Record<LoadType, string> = {
  [LoadType.FTL]: "FTL (Komple)",
  [LoadType.LTL]: "LTL (Parsiyel)",
  [LoadType.FCL]: "FCL (Komple Konteyner)",
  [LoadType.LCL]: "LCL (Parsiyel Konteyner)",
};

/** Which load types make sense for a mode (AIR has none — handled as weight/awb). */
export function loadTypesForMode(mode: TransportMode): LoadType[] {
  switch (mode) {
    case TransportMode.ROAD:
      return [LoadType.FTL, LoadType.LTL];
    case TransportMode.SEA:
      return [LoadType.FCL, LoadType.LCL];
    case TransportMode.AIR:
      return [];
  }
}

/** ROAD assigns a company vehicle + driver; SEA/AIR use carrier + booking/AWB instead. */
export function usesVehicleDriver(mode: TransportMode): boolean {
  return mode === TransportMode.ROAD;
}

/** The mode-specific reference fields captured for a shipment. */
export type ModeFieldKey =
  | "carrierName"
  | "bookingNumber"
  | "containerNumber"
  | "vesselName"
  | "airwaybillNumber"
  | "flightNumber";

export const MODE_FIELD_LABELS: Record<ModeFieldKey, string> = {
  carrierName: "Taşıyıcı (Hat/Havayolu)",
  bookingNumber: "Booking No",
  containerNumber: "Konteyner No",
  vesselName: "Gemi Adı",
  airwaybillNumber: "AWB (Hava Konşimento) No",
  flightNumber: "Uçuş No",
};

/** Ordered reference fields shown for each mode (ROAD has none of these — it uses vehicle/driver). */
export function modeFields(mode: TransportMode): ModeFieldKey[] {
  switch (mode) {
    case TransportMode.ROAD:
      return [];
    case TransportMode.SEA:
      return ["carrierName", "bookingNumber", "containerNumber", "vesselName"];
    case TransportMode.AIR:
      return ["carrierName", "airwaybillNumber", "flightNumber"];
  }
}

// Per-mode overrides of the happy-path status labels. Only the legs that read
// oddly for sea/air are overridden; everything else falls back to the base
// (customer- or supplier-facing) label map.
const SEA_STATUS_OVERRIDES: Partial<Record<ShipmentStatus, string>> = {
  HEADING_TO_PICKUP: "Limana Gidiyor",
  LOADING: "Gemiye Yükleniyor",
  AT_PICKUP_GATE: "Yüklemeye Hazır (Liman)",
  EN_ROUTE: "Denizde (Yolda)",
  AT_DELIVERY_POINT: "Varış Limanında",
};

const AIR_STATUS_OVERRIDES: Partial<Record<ShipmentStatus, string>> = {
  HEADING_TO_PICKUP: "Havalimanına Gidiyor",
  LOADING: "Uçağa Yükleniyor",
  AT_PICKUP_GATE: "Yüklemeye Hazır (Havalimanı)",
  EN_ROUTE: "Havada (Yolda)",
  AT_DELIVERY_POINT: "Varış Havalimanında",
};

/**
 * The status label to show, aware of the shipment's mode and the viewer's
 * side. ROAD keeps the existing (supplier/customer) labels verbatim; SEA/AIR
 * reword the in-transit legs. PENDING/ASSIGNED/COMPLETED/CANCELLED are shared.
 */
export function shipmentStatusLabel(
  mode: TransportMode,
  status: ShipmentStatus,
  viewer: "SUPPLIER" | "CUSTOMER" = "SUPPLIER"
): string {
  if (mode === TransportMode.SEA && SEA_STATUS_OVERRIDES[status]) {
    return SEA_STATUS_OVERRIDES[status]!;
  }
  if (mode === TransportMode.AIR && AIR_STATUS_OVERRIDES[status]) {
    return AIR_STATUS_OVERRIDES[status]!;
  }
  const base =
    viewer === "CUSTOMER" ? customerShipmentStatusLabels : shipmentStatusLabels;
  return base[status];
}
