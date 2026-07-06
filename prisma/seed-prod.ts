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
async function main() {
  const companies = await prisma.company.count();
  if (companies > 0) {
    console.log(
      `Seed atlandı — veritabanında zaten ${companies} firma var (mevcut veri korunuyor).`
    );
    return;
  }
  console.log("Boş veritabanı algılandı — demo veri yükleniyor...");
  await seedDatabase();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
