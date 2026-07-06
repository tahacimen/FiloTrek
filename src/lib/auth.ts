import { compare } from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/db";
import { clearFailedLogins, isLocked, recordFailedLogin } from "@/lib/login-attempts";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        // Try a company user first, falling through to driver then gate
        // guard on ANY failure (not found, inactive, or wrong password)
        // rather than returning null immediately — all three are separate
        // tables with independent unique-email constraints, so nothing at
        // the DB level prevents the same address existing in more than one
        // (e.g. an owner-operator who is both the ADMIN user and personally
        // drives).
        //
        // Each branch also carries its own brute-force lockout (see
        // src/lib/login-attempts.ts): a locked account skips the bcrypt
        // compare entirely but still falls through to the next account
        // type, so a locked-out email reveals nothing beyond the same
        // null every other failure mode already returns.
        const user = await prisma.user.findUnique({
          where: { email },
          include: { company: true },
        });
        if (user && !isLocked(user.lockedUntil)) {
          if (user.isActive && (await compare(password, user.passwordHash))) {
            await clearFailedLogins("user", user.id);
            return {
              id: user.id,
              email: user.email,
              name: user.fullName,
              accountType: "COMPANY_USER",
              companyId: user.companyId,
              companyType: user.company.type,
              companyName: user.company.name,
              companyRole: user.companyRole,
            };
          }
          await recordFailedLogin("user", user.id, user.failedLoginAttempts);
        }

        const driver = await prisma.driver.findUnique({ where: { email } });
        if (driver?.passwordHash && !isLocked(driver.lockedUntil)) {
          if (await compare(password, driver.passwordHash)) {
            await clearFailedLogins("driver", driver.id);
            return {
              id: driver.id,
              email: driver.email ?? email,
              name: driver.fullName,
              accountType: "DRIVER",
              driverId: driver.id,
              companyId: driver.companyId,
            };
          }
          await recordFailedLogin("driver", driver.id, driver.failedLoginAttempts);
        }

        const gateGuard = await prisma.gateGuard.findUnique({
          where: { email },
        });
        if (gateGuard && !isLocked(gateGuard.lockedUntil)) {
          if (
            gateGuard.isActive &&
            (await compare(password, gateGuard.passwordHash))
          ) {
            await clearFailedLogins("gateGuard", gateGuard.id);
            return {
              id: gateGuard.id,
              email: gateGuard.email,
              name: gateGuard.fullName,
              accountType: "GATE_GUARD",
              gateGuardId: gateGuard.id,
              companyId: gateGuard.companyId,
            };
          }
          await recordFailedLogin(
            "gateGuard",
            gateGuard.id,
            gateGuard.failedLoginAttempts
          );
        }

        return null;
      },
    }),
    // Second provider, same session shape as the credentials one above —
    // authenticates a driver by the bearer token from an emailed login
    // link instead of email+password, for drivers who can't reliably type
    // credentials on a phone. See Driver.loginToken in schema.prisma.
    Credentials({
      id: "driver-token",
      name: "Şoför Bağlantısı",
      credentials: { token: { label: "Token", type: "text" } },
      authorize: async (credentials) => {
        const token = credentials?.token;
        if (typeof token !== "string" || !token) {
          return null;
        }

        const driver = await prisma.driver.findUnique({
          where: { loginToken: token },
        });
        if (!driver) return null;

        return {
          id: driver.id,
          email: driver.email ?? undefined,
          name: driver.fullName,
          accountType: "DRIVER",
          driverId: driver.id,
          companyId: driver.companyId,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.accountType = user.accountType;
        token.companyId = user.companyId;
        if (user.accountType === "DRIVER") {
          token.driverId = user.driverId;
        } else if (user.accountType === "GATE_GUARD") {
          token.gateGuardId = user.gateGuardId;
        } else {
          token.companyType = user.companyType;
          token.companyName = user.companyName;
          token.companyRole = user.companyRole;
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      const base = {
        id: token.sub!,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        // Only meaningful with an OAuth/email adapter, which this app
        // doesn't use (Credentials-only) — required by NextAuth's own
        // AdapterUser type regardless.
        emailVerified: null,
        companyId: token.companyId,
      };
      if (token.accountType === "DRIVER") {
        session.user = { ...base, accountType: "DRIVER", driverId: token.driverId! };
      } else if (token.accountType === "GATE_GUARD") {
        session.user = {
          ...base,
          accountType: "GATE_GUARD",
          gateGuardId: token.gateGuardId!,
        };
      } else {
        session.user = {
          ...base,
          accountType: "COMPANY_USER",
          companyType: token.companyType!,
          companyName: token.companyName!,
          companyRole: token.companyRole!,
        };
      }
      return session;
    },
  },
  events: {
    signIn: async ({ user }) => {
      if (!user.id) return;
      if (user.accountType === "DRIVER") {
        await prisma.driver.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      } else if (user.accountType === "GATE_GUARD") {
        await prisma.gateGuard.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }
    },
  },
});
