/**
 * A1: countries a vehicle can be registered in, for plate validation. Curated
 * for Türkiye-centric international road freight (TR plus the neighbours and
 * EU corridors trucks actually run), not an exhaustive ISO list.
 *
 * Plate rules: Türkiye gets a real format check (province 01–81 + 1–3 letters +
 * 2–5 digits). Every other country uses a lenient check (letters/digits, with
 * spaces or dashes, reasonable length) — enforcing each nation's exact plate
 * grammar would reject valid plates, the same caution we use for licence and
 * policy numbers.
 */
export type Country = { code: string; name: string; flag: string };

export const COUNTRIES: readonly Country[] = [
  { code: "TR", name: "Türkiye", flag: "🇹🇷" },
  { code: "BG", name: "Bulgaristan", flag: "🇧🇬" },
  { code: "GR", name: "Yunanistan", flag: "🇬🇷" },
  { code: "RO", name: "Romanya", flag: "🇷🇴" },
  { code: "GE", name: "Gürcistan", flag: "🇬🇪" },
  { code: "AZ", name: "Azerbaycan", flag: "🇦🇿" },
  { code: "IR", name: "İran", flag: "🇮🇷" },
  { code: "IQ", name: "Irak", flag: "🇮🇶" },
  { code: "SY", name: "Suriye", flag: "🇸🇾" },
  { code: "RU", name: "Rusya", flag: "🇷🇺" },
  { code: "UA", name: "Ukrayna", flag: "🇺🇦" },
  { code: "DE", name: "Almanya", flag: "🇩🇪" },
  { code: "AT", name: "Avusturya", flag: "🇦🇹" },
  { code: "IT", name: "İtalya", flag: "🇮🇹" },
  { code: "FR", name: "Fransa", flag: "🇫🇷" },
  { code: "NL", name: "Hollanda", flag: "🇳🇱" },
  { code: "BE", name: "Belçika", flag: "🇧🇪" },
  { code: "PL", name: "Polonya", flag: "🇵🇱" },
  { code: "HU", name: "Macaristan", flag: "🇭🇺" },
  { code: "RS", name: "Sırbistan", flag: "🇷🇸" },
  { code: "MK", name: "Kuzey Makedonya", flag: "🇲🇰" },
  { code: "XK", name: "Kosova", flag: "🇽🇰" },
] as const;

export const DEFAULT_COUNTRY = "TR";

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function countryByCode(code: string | null | undefined): Country | undefined {
  return code ? BY_CODE.get(code) : undefined;
}

export function isValidCountry(code: string): boolean {
  return BY_CODE.has(code);
}

/** "🇹🇷 34 ABC 123" — flag + plate, or just the plate for an unknown code. */
export function plateWithFlag(code: string | null | undefined, plate: string): string {
  const c = countryByCode(code);
  return c ? `${c.flag} ${plate}` : plate;
}

// Province 01–81, 1–3 letters, 2–5 digits, single optional spaces between the
// groups. Case is normalized to upper before this runs.
const TR_PLATE = /^(0[1-9]|[1-7][0-9]|8[01])\s?[A-Z]{1,3}\s?[0-9]{2,5}$/;
// Letters/digits with spaces or dashes; 3–20 chars. Deliberately permissive.
const GENERIC_PLATE = /^[A-Z0-9][A-Z0-9\s-]{1,19}$/;

/** Validation message for a plate under a country's rule, or null if valid. */
export function plateError(country: string, plate: string): string | null {
  if (country === "TR") {
    return TR_PLATE.test(plate)
      ? null
      : "Geçerli bir TR plakası girin (ör. 34 ABC 123).";
  }
  return GENERIC_PLATE.test(plate) ? null : "Geçerli bir plaka girin.";
}
