/**
 * Effective driver status — the single source of truth for "what state is
 * this driver really in right now, and can they be assigned a shipment?".
 *
 * The stored `DriverStatus` column only ever holds AVAILABLE / ON_TRIP /
 * OFF_DUTY (ON_TRIP is the shipment-lifecycle projection; OFF_DUTY is the
 * dispatcher's manual "Görevde Değil" toggle). Two more states are derived,
 * never stored, so they resolve themselves without a background job:
 *   - DEACTIVATED: a hard, permanent block (isActive=false, N7).
 *   - ON_LEAVE: today falls inside [leaveStartDate, leaveEndDate] (N2) — the
 *     driver reverts to its stored status automatically once the window ends.
 *
 * Priority (most urgent first), matching the agreed rule
 * "Seferde > İzinli > Görevde Değil > Müsait", with DEACTIVATED above all:
 *   DEACTIVATED > ON_TRIP > ON_LEAVE > OFF_DUTY > AVAILABLE
 *
 * Pure date math + enum logic only — no DB or React here, so both the server
 * (assignment guard, dashboard counts) and the client (driver table badges)
 * share exactly one definition.
 */
import { DriverStatus } from "@/generated/prisma/enums";

export type EffectiveDriverStatus =
  | "DEACTIVATED"
  | "ON_TRIP"
  | "ON_LEAVE"
  | "OFF_DUTY"
  | "AVAILABLE";

export type DriverStatusInput = {
  status: DriverStatus;
  isActive: boolean;
  leaveStartDate: Date | string | null;
  leaveEndDate: Date | string | null;
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True when `now` falls within the driver's scheduled leave window (inclusive). */
export function isOnLeave(driver: DriverStatusInput, now: Date = new Date()): boolean {
  const start = toDate(driver.leaveStartDate);
  const end = toDate(driver.leaveEndDate);
  if (!start || !end) return false;
  return now >= startOfDay(start) && now <= endOfDay(end);
}

export function effectiveDriverStatus(
  driver: DriverStatusInput,
  now: Date = new Date()
): EffectiveDriverStatus {
  if (!driver.isActive) return "DEACTIVATED";
  if (driver.status === DriverStatus.ON_TRIP) return "ON_TRIP";
  if (isOnLeave(driver, now)) return "ON_LEAVE";
  if (driver.status === DriverStatus.OFF_DUTY) return "OFF_DUTY";
  return "AVAILABLE";
}

/** A driver can be assigned a new shipment only when truly free right now. */
export function isDriverAssignable(
  driver: DriverStatusInput,
  now: Date = new Date()
): boolean {
  return effectiveDriverStatus(driver, now) === "AVAILABLE";
}

export const effectiveDriverStatusLabels: Record<EffectiveDriverStatus, string> = {
  DEACTIVATED: "Deaktif",
  ON_TRIP: "Seferde",
  ON_LEAVE: "İzinli",
  OFF_DUTY: "Görevde Değil",
  AVAILABLE: "Müsait",
};

export const effectiveDriverStatusBadgeVariant: Record<
  EffectiveDriverStatus,
  "default" | "secondary" | "outline" | "destructive" | "success" | "warning"
> = {
  DEACTIVATED: "destructive",
  ON_TRIP: "default",
  ON_LEAVE: "warning",
  OFF_DUTY: "secondary",
  AVAILABLE: "success",
};
