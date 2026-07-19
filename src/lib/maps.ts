/**
 * A universal Google Maps "directions to destination" link. Opens the native
 * Maps app on iOS/Android and the web map elsewhere; needs no API key and no
 * billing (unlike the Maps JS/Directions APIs). Used to give drivers a
 * one-tap "get me there" for pickup, delivery and dock-reservation points.
 */
export function directionsUrl(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination
  )}`;
}

/**
 * Prefer a hand-entered maps URL (a customer may have pasted an exact pin);
 * otherwise fall back to a directions link built from the address text, so a
 * driver always has a working navigation link as long as *some* location is
 * known. Returns null only when neither is available.
 */
export function resolveNavUrl(
  storedUrl: string | null | undefined,
  address: string | null | undefined
): string | null {
  if (storedUrl && storedUrl.trim()) return storedUrl.trim();
  if (address && address.trim()) return directionsUrl(address.trim());
  return null;
}
