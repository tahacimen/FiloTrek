import "dotenv/config";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { prisma } from "../../src/lib/db";

const runId = process.argv[2];
if (!runId) {
  throw new Error("Usage: tsx e2e/fixtures/cleanup.ts <runId>");
}

const fixturePath = path.join(process.cwd(), "e2e", `.fixture-${runId}.json`);

async function main() {
  const { supplierCompanyId, customerCompanyId } = JSON.parse(
    readFileSync(fixturePath, "utf-8")
  );
  const companyIds = [supplierCompanyId, customerCompanyId];

  const [vehicleIds, driverIds, shipmentIds] = await Promise.all([
    prisma.vehicle
      .findMany({ where: { companyId: supplierCompanyId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id)),
    prisma.driver
      .findMany({ where: { companyId: supplierCompanyId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id)),
    prisma.shipment
      .findMany({ where: { supplierCompanyId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id)),
  ]);

  await prisma.statusHistory.deleteMany({
    where: { entityId: { in: [...vehicleIds, ...driverIds, ...shipmentIds] } },
  });
  await prisma.shipment.deleteMany({ where: { supplierCompanyId } });
  await prisma.vehicle.deleteMany({ where: { companyId: supplierCompanyId } });
  await prisma.driver.deleteMany({ where: { companyId: supplierCompanyId } });
  await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });

  rmSync(fixturePath, { force: true });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
