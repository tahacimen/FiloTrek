import type { Driver } from "@/generated/prisma/client";

/**
 * `passwordHash` must never cross the Server -> Client Component boundary —
 * Next.js serializes the *entire* object into the RSC payload sent to the
 * browser regardless of which fields a client component actually reads, so
 * any raw `Driver` row reaching driver-table.tsx / driver-form-dialog.tsx /
 * assign-dialog.tsx would ship every driver's bcrypt hash to the browser on
 * an ordinary page load. Mirrors the SerializableVehicle pattern in
 * vehicles/types.ts (there for a different reason — Decimal isn't
 * serializable — same fix shape: convert once, at the Server Component
 * boundary, before the value is ever passed as a client component prop).
 *
 * `loginToken` is stripped for the same reason as `passwordHash` — it's a
 * bearer credential equivalent to a password (see Driver.loginToken in
 * schema.prisma), not just an opaque id. `hasActiveLoginLink` is the one
 * bit of information about it the UI actually needs (whether to show
 * "revoke" vs. leave it disabled) — derived here rather than exposing the
 * token itself.
 *
 * `tcNumber` is deliberately kept (unlike passwordHash/loginToken) — it's
 * the driver's own employer's dispatcher viewing their own employee's
 * profile, already scoped to that company, same protection domain as
 * phone/license number.
 */
export type SerializableDriver = Omit<Driver, "passwordHash" | "loginToken"> & {
  hasActiveLoginLink: boolean;
};

export function toSerializableDriver(driver: Driver): SerializableDriver {
  const { passwordHash: _passwordHash, loginToken, ...rest } = driver;
  return { ...rest, hasActiveLoginLink: loginToken !== null };
}
