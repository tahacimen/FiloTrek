import { prisma } from "@/lib/db";

/**
 * Shared brute-force lockout for the three password-based account types
 * (User, Driver, GateGuard). The driver-token provider is exempt — a
 * 256-bit bearer token isn't guessable, so there's nothing to lock out.
 */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

type AccountKind = "user" | "driver" | "gateGuard";

export function isLocked(lockedUntil: Date | null): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > Date.now();
}

export async function recordFailedLogin(
  kind: AccountKind,
  id: string,
  currentAttempts: number
) {
  const attempts = currentAttempts + 1;
  const data = {
    failedLoginAttempts: attempts,
    lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null,
  };
  if (kind === "user") await prisma.user.update({ where: { id }, data });
  else if (kind === "driver") await prisma.driver.update({ where: { id }, data });
  else await prisma.gateGuard.update({ where: { id }, data });
}

export async function clearFailedLogins(kind: AccountKind, id: string) {
  const data = { failedLoginAttempts: 0, lockedUntil: null };
  if (kind === "user") await prisma.user.update({ where: { id }, data });
  else if (kind === "driver") await prisma.driver.update({ where: { id }, data });
  else await prisma.gateGuard.update({ where: { id }, data });
}
