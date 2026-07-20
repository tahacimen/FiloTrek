"use client";

/**
 * Free client-side geocoding via OpenStreetMap Nominatim — turns a shipment's
 * origin/destination address text into coordinates so the dashboard map can
 * plot it even before the driver shares live GPS. No API key, no billing.
 *
 * Done in the browser (not the server) so each user's own IP spreads the load
 * and no server egress/latency is added. Results are cached in-memory and in
 * localStorage (addresses don't move), and real network calls are throttled to
 * ~1/sec to respect Nominatim's usage policy. Any failure resolves to null —
 * the shipment simply stays off the map, never breaks the page.
 */
export type LatLng = { lat: number; lng: number };

const memory = new Map<string, LatLng | null>();
let lastFetchAt = 0;

function cacheKey(q: string) {
  return `geo:tr:${q}`;
}

async function throttle() {
  const wait = Math.max(0, 1000 - (Date.now() - lastFetchAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt = Date.now();
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const q = address?.trim().toLowerCase();
  if (!q) return null;
  if (memory.has(q)) return memory.get(q)!;

  try {
    const stored = localStorage.getItem(cacheKey(q));
    if (stored) {
      const value = JSON.parse(stored) as LatLng | null;
      memory.set(q, value);
      return value;
    }
  } catch {
    // localStorage unavailable (private mode etc.) — fall through to network.
  }

  let result: LatLng | null = null;
  try {
    await throttle();
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=${encodeURIComponent(
      address.trim()
    )}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (Array.isArray(data) && data[0]) {
        result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    }
  } catch {
    result = null;
  }

  memory.set(q, result);
  try {
    localStorage.setItem(cacheKey(q), JSON.stringify(result));
  } catch {
    // ignore quota / unavailable
  }
  return result;
}
