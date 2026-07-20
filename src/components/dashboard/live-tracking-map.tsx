"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

export type TrackingMarker = { id: string; lat: number; lng: number; label: string };

// Recenters the map when the selected marker changes (leaflet imperative API).
function Recenter({ marker }: { marker: TrackingMarker | null }) {
  const map = useMap();
  useEffect(() => {
    if (marker) map.setView([marker.lat, marker.lng], 12, { animate: true });
  }, [marker, map]);
  return null;
}

/**
 * Multi-marker live map for the dashboard board. Free OpenStreetMap tiles (no
 * API key). CircleMarkers avoid Leaflet's broken-default-icon issue under the
 * Next.js bundler (same rationale as ShipmentLiveMap). The selected marker is
 * larger with a dark ring; clicking any marker selects it.
 */
export function LiveTrackingMap({
  markers,
  selectedId,
  onSelect,
}: {
  markers: TrackingMarker[];
  selectedId: string | null;
  onSelect?: (id: string) => void;
}) {
  const selected =
    markers.find((m) => m.id === selectedId) ?? markers[0] ?? null;
  // Fall back to a whole-Türkiye view when nothing has a location yet.
  const center: [number, number] = selected
    ? [selected.lat, selected.lng]
    : [39.2, 35.2];

  return (
    <MapContainer
      center={center}
      zoom={selected ? 11 : 5}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%", minHeight: "440px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanlar'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter marker={selected} />
      {markers.map((m) => {
        const active = m.id === (selected?.id ?? null);
        return (
          <CircleMarker
            key={m.id}
            center={[m.lat, m.lng]}
            radius={active ? 12 : 8}
            pathOptions={{
              color: active ? "#1e1e1e" : "#f5b301",
              weight: active ? 3 : 1,
              fillColor: "#f5b301",
              fillOpacity: active ? 1 : 0.7,
            }}
            eventHandlers={{ click: () => onSelect?.(m.id) }}
          >
            <Popup>{m.label}</Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
