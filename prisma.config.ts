import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma CLI (migrate/db) only — runtime queries never use this; they go
    // through the driver adapter (adapter-pg reading DATABASE_URL, see
    // src/lib/db.ts). On Supabase + Vercel, DATABASE_URL is the transaction
    // pooler (6543, IPv4, serverless-friendly) but migrations need a
    // session-mode connection (advisory locks aren't supported through the
    // transaction pooler) — that's DIRECT_URL (session pooler, 5432). Falls
    // back to DATABASE_URL when DIRECT_URL is unset (local dev points both at
    // the same database, so migrate keeps working with a single var).
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
