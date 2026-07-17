"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

/**
 * Deliberately renders a CircleMarker (a plain colored circle), not
 * react-leaflet's default pin icon — Leaflet's default marker images are
 * referenced by a relative path that breaks under Next.js's bundler unless
 * you manually re-point L.Icon.Default's URLs. A circle needs no image
 * assets at all, sidestepping that well-known issue entirely.
 *
 * Tiles: the public OpenStreetMap tile server — free, no API key, subject
 * to OSM's fair-use policy (fine at this app's scale). Attribution below is
 * required by that policy, not decorative.
 */
export function ShipmentLiveMap({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label: string;
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={12}
      scrollWheelZoom={false}
      style={{ height: "260px", width: "100%", borderRadius: "var(--radius)" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanlar'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker
        center={[lat, lng]}
        radius={9}
        pathOptions={{ color: "#f5b301", fillColor: "#f5b301", fillOpacity: 0.9 }}
      >
        <Popup>{label}</Popup>
      </CircleMarker>
    </MapContainer>
  );
}
