import "dotenv/config";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { hash } from "bcryptjs";

import { prisma } from "../../src/lib/db";
import { CompanyType } from "../../src/generated/prisma/client";

const runId = process.argv[2];
if (!runId) {
  throw new Error("Usage: tsx e2e/fixtures/setup.ts <runId>");
}

const dispatcherEmail = `e2e-dispatcher-${runId}@test.local`;
const customerUserEmail = `e2e-customer-${runId}@test.local`;
const driverEmail = `e2e-driver-${runId}@test.local`;
const password = "E2ePassword1!";
// Distinct "FIX" prefix so these can never collide with golden-path.spec.ts's
// own PLATE/LICENSE constants — that spec uses the same runId (passed as
// this script's argv) to compute its own "E2E ${runId}" / "E2ELIC${runId}"
// values for the vehicle/driver it creates through the UI, and both specs
// invoke this same setup script.
const plate = `E2EFIX ${runId}`.slice(0, 15);
const driverName = "E2E Fixture Şoför";

async function main() {
  const supplier = await prisma.company.create({
    data: { name: `E2E Tedarikçi ${runId}`, type: CompanyType.SUPPLIER },
  });
  const customer = await prisma.company.create({
    data: { name: `E2E Müşteri ${runId}`, type: CompanyType.CUSTOMER },
  });
  const passwordHash = await hash(password, 10);
  await prisma.user.create({
    data: {
      companyId: supplier.id,
      email: dispatcherEmail,
      passwordHash,
      fullName: "E2E Dispatcher",
      companyRole: "ADMIN",
    },
  });
  await prisma.user.create({
    data: {
      companyId: customer.id,
      email: customerUserEmail,
      passwordHash,
      fullName: "E2E Customer User",
      companyRole: "ADMIN",
    },
  });
  // Pre-created so the notification/assignment test can go straight to
  // assigning without re-testing vehicle/driver creation (already covered
  // by the golden-path spec).
  await prisma.vehicle.create({
    data: {
      companyId: supplier.id,
      plate,
      vehicleType: "KAMYON",
      bedType: "KAPALI_KASA",
      tonnageCapacity: 10,
      status: "AVAILABLE",
    },
  });
  await prisma.driver.create({
    data: {
      companyId: supplier.id,
      fullName: driverName,
      phone: "0500 000 00 00",
      licenseNumber: `E2EFIXLIC${runId}`,
      status: "AVAILABLE",
      email: driverEmail,
      passwordHash,
    },
  });

  writeFileSync(
    path.join(process.cwd(), "e2e", `.fixture-${runId}.json`),
    JSON.stringify({
      supplierCompanyId: supplier.id,
      supplierName: supplier.name,
      customerCompanyId: customer.id,
      customerName: customer.name,
      email: dispatcherEmail,
      customerUserEmail,
      driverEmail,
      password,
      vehiclePlate: plate,
      driverName,
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
