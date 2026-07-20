"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { LatLngBounds } from "leaflet";

export type LatLng = { lat: number; lng: number };
export type TrackingMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  live: boolean;
};
export type RouteInfo = {
  origin?: LatLng;
  dest?: LatLng;
  current?: LatLng;
} | null;

// Fits the map to the selected shipment's route (or centers on it) whenever
// the selection / route changes — leaflet's imperative API.
function FitView({
  route,
  fallback,
}: {
  route: RouteInfo;
  fallback: LatLng | null;
}) {
  const map = useMap();
  useEffect(() => {
    const pts = route
      ? [route.origin, route.current, route.dest].filter(
          (p): p is LatLng => !!p
        )
      : [];
    if (pts.length >= 2) {
      map.fitBounds(
        new LatLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])),
        { padding: [40, 40], maxZoom: 13, animate: true }
      );
    } else if (fallback) {
      map.setView([fallback.lat, fallback.lng], 12, { animate: true });
    }
  }, [route, fallback, map]);
  return null;
}

export function LiveTrackingMap({
  markers,
  route,
  selectedId,
  onSelect,
}: {
  markers: TrackingMarker[];
  route: RouteInfo;
  selectedId: string | null;
  onSelect?: (id: string) => void;
}) {
  const selected = markers.find((m) => m.id === selectedId) ?? null;
  const fallback: LatLng | null = selected
    ? { lat: selected.lat, lng: selected.lng }
    : (markers[0] ?? null);

  const polyPoints = route
    ? [route.origin, route.current, route.dest]
        .filter((p): p is LatLng => !!p)
        .map((p) => [p.lat, p.lng] as [number, number])
    : [];

  return (
    <MapContainer
      center={fallback ? [fallback.lat, fallback.lng] : [39.2, 35.2]}
      zoom={fallback ? 11 : 5}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%", minHeight: "440px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanlar'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitView route={route} fallback={fallback} />

      {polyPoints.length >= 2 && (
        <Polyline
          positions={polyPoints}
          pathOptions={{ color: "#f5b301", weight: 3, dashArray: "6 8" }}
        />
      )}

      {/* Route endpoints for the selected shipment */}
      {route?.origin && (
        <CircleMarker
          center={[route.origin.lat, route.origin.lng]}
          radius={7}
          pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.9 }}
        >
          <Popup>Çıkış noktası</Popup>
        </CircleMarker>
      )}
      {route?.dest && (
        <CircleMarker
          center={[route.dest.lat, route.dest.lng]}
          radius={7}
          pathOptions={{ color: "#1e1e1e", fillColor: "#1e1e1e", fillOpacity: 0.9 }}
        >
          <Popup>Varış noktası</Popup>
        </CircleMarker>
      )}

      {/* One marker per shipment at its best-known point (live GPS or origin) */}
      {markers.map((m) => {
        const active = m.id === selectedId;
        return (
          <CircleMarker
            key={m.id}
            center={[m.lat, m.lng]}
            radius={active ? 12 : 8}
            pathOptions={{
              color: active ? "#1e1e1e" : "#f5b301",
              weight: active ? 3 : 1,
              fillColor: "#f5b301",
              fillOpacity: m.live ? 0.95 : 0.35,
            }}
            eventHandlers={{ click: () => onSelect?.(m.id) }}
          >
            <Popup>
              {m.label}
              {!m.live && " (adresten — canlı konum bekleniyor)"}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
