import "dotenv/config";

import { prisma } from "../src/lib/db";
import { seedDatabase } from "./seed-core";

/**
 * Production seed, run from the Vercel build command AFTER
 * `prisma migrate deploy`. Guarded: only seeds when the database is empty, so
 * it populates the demo dataset (and the initial admin login) on the very
 * first deploy and then does nothing on every deploy after — real data is
 * never touched. This app has no public sign-up, so an empty database would
 * otherwise have no account to log in with at all.
 */
/**
 * Idempotent: promotes the site owner to platform admin on every deploy so
 * /admin (invitations + signup requests) is reachable even on an already-
 * seeded database, where seedDatabase() no longer runs. Driven by
 * PLATFORM_ADMIN_EMAIL, defaulting to the seeded owner account. Uses
 * updateMany so a missing user is a no-op rather than an error.
 */
async function ensurePlatformAdmin() {
  const email = process.env.PLATFORM_ADMIN_EMAIL ?? "thcmn4444@gmail.com";
  const result = await prisma.user.updateMany({
    where: { email, isPlatformAdmin: false },
    data: { isPlatformAdmin: true },
  });
  if (result.count > 0) {
    console.log(`Platform admin yetkisi verildi: ${email}`);
  }
}

async function main() {
  const companies = await prisma.company.count();
  if (companies > 0) {
    console.log(
      `Seed atlandı — veritabanında zaten ${companies} firma var (mevcut veri korunuyor).`
    );
  } else {
    console.log("Boş veritabanı algılandı — demo veri yükleniyor...");
    await seedDatabase();
  }
  await ensurePlatformAdmin();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
