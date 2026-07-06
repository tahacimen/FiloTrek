import "dotenv/config";

import { prisma } from "../src/lib/db";
import { seedDatabase } from "./seed-core";

/**
 * Local/dev seed (npx prisma db seed / tsx prisma/seed.ts): wipes everything
 * first, then re-seeds. Production uses prisma/seed-prod.ts instead, which is
 * guarded (only seeds an empty DB) and never deletes.
 */
async function main() {
  console.log("Seed verisi temizleniyor...");
  await prisma.statusHistory.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.gateGuard.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

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
