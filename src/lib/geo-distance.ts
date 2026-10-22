/**
 * C2: free, key-less road-distance estimation. Geocodes the two endpoints
 * with OpenStreetMap Nominatim, then asks the public OSRM router for the
 * driving distance between them. Server-only (both hosts are called from a
 * Server Action, so no client CSP entry is needed, unlike the Leaflet map).
 *
 * Deliberately best-effort: any failure (geocode miss, network, rate-limit)
 * resolves to null so the caller can fall back to a manual km entry rather
 * than blocking the "Araç Çağır" flow. Google's paid Distance Matrix was the
 * alternative; this keeps the product free, consistent with the existing
 * Nominatim/OSM map usage.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = "https://router.project-osrm.org/route/v1/driving";

// Nominatim's usage policy requires an identifying User-Agent.
const USER_AGENT = "Logigo/1.0 (fleet freight app; +https://logigotr.com)";

async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  const q = query.trim();
  if (!q) return null;
  const url = `${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=tr`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "tr" },
      // Never cache a geocode result beyond a day; coordinates are stable.
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = data[0];
    if (!first) return null;
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

/**
 * Road distance in km between two free-text locations, rounded to a whole
 * number, or null if it can't be determined. Endpoints are geocoded
 * sequentially to stay within Nominatim's ~1 req/s policy.
 */
export async function computeRoadDistanceKm(
  originQuery: string,
  destinationQuery: string
): Promise<number | null> {
  const origin = await geocode(originQuery);
  if (!origin) return null;
  const destination = await geocode(destinationQuery);
  if (!destination) return null;

  const coords = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
  const url = `${OSRM}/${coords}?overview=false`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code: string;
      routes?: Array<{ distance: number }>;
    };
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    const meters = data.routes[0].distance;
    if (!Number.isFinite(meters) || meters <= 0) return null;
    return Math.round(meters / 1000);
  } catch {
    return null;
  }
}
