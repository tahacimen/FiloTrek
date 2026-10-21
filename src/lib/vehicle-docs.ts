/**
 * Vehicle document validity helpers (see the Vehicle model's document fields
 * in schema.prisma). Pure date math shared by the server (dashboard warning
 * count) and the client (Araçlar table badges) — no DB or React here.
 */

export type DocExpiryStatus = "none" | "ok" | "soon" | "expired";

/** A document expiring within this many days is flagged as "yaklaşıyor". */
export const DOC_EXPIRY_SOON_DAYS = 30;

export function docExpiryStatus(
  date: Date | string | null | undefined,
  soonDays: number = DOC_EXPIRY_SOON_DAYS
): { status: DocExpiryStatus; daysLeft: number | null } {
  if (!date) return { status: "none", daysLeft: null };
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return { status: "none", daysLeft: null };
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const daysLeft = Math.round(
    (d.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (daysLeft < 0) return { status: "expired", daysLeft };
  if (daysLeft <= soonDays) return { status: "soon", daysLeft };
  return { status: "ok", daysLeft };
}

const SEVERITY: Record<DocExpiryStatus, number> = {
  expired: 3,
  soon: 2,
  ok: 1,
  none: 0,
};

/** The most urgent status across a vehicle's tracked documents. */
export function vehicleWorstDocStatus(vehicle: {
  inspectionExpiry: Date | string | null;
  insuranceExpiry: Date | string | null;
}): DocExpiryStatus {
  const a = docExpiryStatus(vehicle.inspectionExpiry).status;
  const b = docExpiryStatus(vehicle.insuranceExpiry).status;
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

/** True when a vehicle has a document expired or expiring soon — "ilgi gerekir". */
export function vehicleNeedsDocAttention(vehicle: {
  inspectionExpiry: Date | string | null;
  insuranceExpiry: Date | string | null;
}): boolean {
  const s = vehicleWorstDocStatus(vehicle);
  return s === "expired" || s === "soon";
}

/**
 * N1: which legally-required document fields are still empty on a vehicle.
 * Pre-existing vehicles (created before documents became mandatory) keep null
 * values; this drives the "belge eksik" flag instead of blocking them. The
 * labels match the vehicle form's own field labels.
 */
export type VehicleDocFields = {
  registrationNumber: string | null;
  insurancePolicyNumber: string | null;
  inspectionExpiry: Date | string | null;
  insuranceExpiry: Date | string | null;
};

const DOC_FIELD_LABELS: { key: keyof VehicleDocFields; label: string }[] = [
  { key: "registrationNumber", label: "Ruhsat No" },
  { key: "insurancePolicyNumber", label: "Trafik Sigortası Poliçe No" },
  { key: "inspectionExpiry", label: "Muayene Bitiş" },
  { key: "insuranceExpiry", label: "Sigorta Bitiş" },
];

export function vehicleMissingDocFields(vehicle: VehicleDocFields): string[] {
  return DOC_FIELD_LABELS.filter(({ key }) => {
    const v = vehicle[key];
    return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
  }).map(({ label }) => label);
}

/** True when a vehicle is missing any legally-required document field. */
export function vehicleHasMissingDocs(vehicle: VehicleDocFields): boolean {
  return vehicleMissingDocFields(vehicle).length > 0;
}

/** Short human label for a document's status, e.g. "12 gün" / "Süresi doldu". */
export function docStatusLabel(
  date: Date | string | null | undefined
): string {
  const { status, daysLeft } = docExpiryStatus(date);
  switch (status) {
    case "none":
      return "—";
    case "expired":
      return "Süresi doldu";
    case "soon":
      return daysLeft === 0 ? "Bugün doluyor" : `${daysLeft} gün kaldı`;
    case "ok":
      return "Geçerli";
  }
}
