import type { CompanyRole, CompanyType } from "@/generated/prisma/client";
import type { DefaultSession } from "next-auth";
// Required for the `declare module "next-auth/jwt"` augmentation below to
// actually merge with the real JWT interface — without importing JWT here
// first, TypeScript treats it as declaring a new ambient module instead of
// augmenting the existing one, and `token.*` fields resolve to `unknown`.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { JWT } from "next-auth/jwt";

type BaseSessionUser = { id: string } & DefaultSession["user"];

/** A dispatcher/company-side login — the only kind that existed before driver logins. */
export type CompanyUserSession = BaseSessionUser & {
  accountType: "COMPANY_USER";
  companyId: string;
  companyType: CompanyType;
  companyName: string;
  companyRole: CompanyRole;
};

/** A driver's own scoped login — deliberately has no companyType/companyRole. */
export type DriverSessionUser = BaseSessionUser & {
  accountType: "DRIVER";
  driverId: string;
  companyId: string;
};

/** A gate guard ("Nizamiye") login — same shape as DriverSessionUser, distinct accountType. */
export type GateGuardSessionUser = BaseSessionUser & {
  accountType: "GATE_GUARD";
  gateGuardId: string;
  companyId: string;
};

declare module "next-auth" {
  // Interfaces can't be unions, so the three account shapes are merged flat
  // here (fields from the other branches are optional) — but Session.user
  // itself (declared right below) IS a real discriminated union, which is
  // what actually matters: it's what every call site reads from.
  interface User {
    accountType: "COMPANY_USER" | "DRIVER" | "GATE_GUARD";
    companyId: string;
    companyType?: CompanyType;
    companyName?: string;
    companyRole?: CompanyRole;
    driverId?: string;
    gateGuardId?: string;
  }

  interface Session {
    user: CompanyUserSession | DriverSessionUser | GateGuardSessionUser;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accountType: "COMPANY_USER" | "DRIVER" | "GATE_GUARD";
    companyId: string;
    companyType?: CompanyType;
    companyName?: string;
    companyRole?: CompanyRole;
    driverId?: string;
    gateGuardId?: string;
  }
}
