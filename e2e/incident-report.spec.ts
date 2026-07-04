import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const RUN_ID = String(Date.now());

const projectRoot = path.join(__dirname, "..");
const tsxBin = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx"
);

function runFixtureScript(script: string, ...args: string[]) {
  const quotedArgs = [script, ...args].map((a) => `"${a}"`).join(" ");
  execSync(`"${tsxBin}" ${quotedArgs}`, {
    cwd: projectRoot,
    stdio: "inherit",
  });
}

let fixture: {
  supplierCompanyId: string;
  supplierName: string;
  customerCompanyId: string;
  customerName: string;
  email: string;
  customerUserEmail: string;
  driverEmail: string;
  password: string;
  vehiclePlate: string;
  driverName: string;
};

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill(password);
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  // Redirect target differs by account type (/dashboard vs /driver) — see
  // driver-workflow.spec.ts's login() for why this waits on "not /login"
  // rather than one specific URL.
  await expect(page).not.toHaveURL(/\/login/);
}

async function logout(page: Page, fullName: string) {
  await page.getByRole("button", { name: new RegExp(fullName) }).click();
  await page.getByRole("menuitem", { name: "Çıkış Yap" }).click();
  await expect(page).toHaveURL(/\/login/);
}

test.describe("Driver breakdown ('arıza') reporting", () => {
  test.beforeAll(() => {
    runFixtureScript("e2e/fixtures/setup.ts", RUN_ID);
    fixture = JSON.parse(
      readFileSync(path.join(__dirname, `.fixture-${RUN_ID}.json`), "utf-8")
    );
  });

  test.afterAll(() => {
    runFixtureScript("e2e/fixtures/cleanup.ts", RUN_ID);
  });

  test("driver reports a breakdown, both sides see the warning badge without the shipment's own status changing, dispatcher resolves it", async ({
    page,
  }) => {
    // Every mutating button now shows a native confirm() — Playwright
    // auto-dismisses dialogs unless a handler is registered.
    page.on("dialog", (dialog) => dialog.accept());

    let shipmentUrl = "";

    await test.step("customer requests a vehicle", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);
      await page.getByRole("link", { name: "Araç Çağır" }).first().click();
      await page.getByLabel("Tedarikçi Firma").click();
      await page.getByRole("option", { name: fixture.supplierName }).click();
      await page
        .getByLabel("Yükleme Noktası", { exact: true })
        .fill("Konya");
      await page
        .getByLabel("Teslimat Noktası", { exact: true })
        .fill("Adana");
      await page.getByLabel("Mesafe (km)").fill("300");
      await page.getByLabel("Tonaj (ton)").fill("6");
      await page.getByRole("button", { name: "Araç Çağır" }).click();
      await expect(page).toHaveURL(
        /\/shipments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
      );
      shipmentUrl = page.url();
    });

    await logout(page, "E2E Customer User");

    await test.step("supplier assigns with a price, then departs", async () => {
      await login(page, fixture.email, fixture.password);
      await page.goto("/assign");
      const row = page
        .getByTestId("pending-shipment-row")
        .filter({ hasText: "Konya" });
      await row.getByRole("button", { name: "Ata" }).click();
      await page.getByLabel("Araç", { exact: true }).click();
      await page
        .getByRole("option", { name: new RegExp(fixture.vehiclePlate) })
        .click();
      await page.getByLabel("Şoför", { exact: true }).click();
      await page.getByRole("option", { name: fixture.driverName }).click();
      await page.getByLabel("Nakliye Fiyatı").fill("12000");
      await page.getByRole("button", { name: "Sefere Ata" }).click();
      await expect(page.getByTestId("pending-shipment-row")).toHaveCount(0);
    });

    await logout(page, "E2E Dispatcher");

    await test.step("customer approves the price", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);
      await page.goto(shipmentUrl);
      await page.getByRole("button", { name: "Fiyatı Onayla" }).click();
      await expect(page.getByText("Onaylandı", { exact: true })).toBeVisible();
    });

    await logout(page, "E2E Customer User");

    await test.step("supplier sends the vehicle off", async () => {
      await login(page, fixture.email, fixture.password);
      await page.goto(shipmentUrl);
      await page.getByRole("button", { name: "Yüklemeye Gidiyor" }).click();
      await expect(page.getByTestId("shipment-status-badge")).toHaveText(
        "Yüklemeye Gidiyor"
      );
    });

    await logout(page, "E2E Dispatcher");

    await test.step("driver reports a breakdown — the shipment's own status is untouched", async () => {
      await login(page, fixture.driverEmail, fixture.password);
      await expect(page).toHaveURL(/\/driver/);

      await page.getByRole("button", { name: "Arıza Bildir" }).click();
      await page
        .getByLabel("Not (opsiyonel)")
        .fill("Motor arızası, yol kenarında bekliyorum");
      await page.getByRole("button", { name: "Arızayı Bildir" }).click();

      // The dialog closes itself on success (see useCloseOnSuccess) and the
      // report button flips to the resolve one — both prove the report
      // landed without needing a reload.
      await expect(
        page.getByRole("button", { name: "Arıza Giderildi" })
      ).toBeVisible();
      // Still "Yüklemeye Gidiyor" — a breakdown never changes the
      // shipment's own status, only adds a warning badge alongside it.
      await expect(
        page.getByText("Yüklemeye Gidiyor", { exact: true })
      ).toBeVisible();
      await expect(page.getByText("Arıza", { exact: true })).toBeVisible();
    });

    await logout(page, fixture.driverName);

    await test.step("customer sees the breakdown badge and details, but no resolve action", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);
      await page.goto(shipmentUrl);

      await expect(page.getByText("Arıza Bildirildi")).toBeVisible();
      await expect(
        page.getByText("Motor arızası, yol kenarında bekliyorum")
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sorunu Gider" })
      ).toHaveCount(0);
    });

    await logout(page, "E2E Customer User");

    await test.step("dispatcher resolves the breakdown, clearing the badge", async () => {
      await login(page, fixture.email, fixture.password);
      await page.goto(shipmentUrl);

      await expect(page.getByText("Arıza Bildirildi")).toBeVisible();
      await page.getByRole("button", { name: "Sorunu Gider" }).click();
      await page
        .getByRole("button", { name: "Giderildi Olarak İşaretle" })
        .click();

      await expect(page.getByText("Arıza Bildirildi")).toHaveCount(0);
      await expect(page.getByText("Arıza", { exact: true })).toHaveCount(0);
    });
  });
});
