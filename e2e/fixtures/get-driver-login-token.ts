import "dotenv/config";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../../src/lib/db";

// SMTP isn't configured in this environment (email-service.ts just logs and
// no-ops), so there's no inbox to read the link from in an e2e run — the
// token in the database IS the link's payload, so reading it directly here
// is the equivalent of "receiving the email" for test purposes.
const [runId, driverEmail] = process.argv.slice(2);
if (!runId || !driverEmail) {
  throw new Error(
    "Usage: tsx e2e/fixtures/get-driver-login-token.ts <runId> <driverEmail>"
  );
}

async function main() {
  const driver = await prisma.driver.findUniqueOrThrow({
    where: { email: driverEmail },
  });
  writeFileSync(
    path.join(process.cwd(), "e2e", `.login-token-${runId}.json`),
    JSON.stringify({ loginToken: driver.loginToken })
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
