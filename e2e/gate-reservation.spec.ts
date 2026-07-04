import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const RUN_ID = String(Date.now());
const ORIGIN_MAPS_URL = "https://maps.google.com/?q=38.7312,35.4787";
const DESTINATION_MAPS_URL = "https://maps.google.com/?q=36.9914,35.3308";

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
  password: string;
  vehiclePlate: string;
  driverName: string;
};

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill(password);
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function logout(page: Page, fullName: string) {
  await page.getByRole("button", { name: new RegExp(fullName) }).click();
  await page.getByRole("menuitem", { name: "Çıkış Yap" }).click();
  await expect(page).toHaveURL(/\/login/);
}

function assertNavigationLinks(page: Page) {
  const links = page.getByRole("link", { name: "Navigasyonu Başlat" });
  return expect(links).toHaveCount(2);
}

test.describe("Kapı Rezervasyonu: customer-entered navigation links, read-only for the supplier", () => {
  test.beforeAll(() => {
    runFixtureScript("e2e/fixtures/setup.ts", RUN_ID);
    fixture = JSON.parse(
      readFileSync(path.join(__dirname, `.fixture-${RUN_ID}.json`), "utf-8")
    );
  });

  test.afterAll(() => {
    runFixtureScript("e2e/fixtures/cleanup.ts", RUN_ID);
  });

  test("customer sets both gate-reservation links at request time; supplier can view but not edit them", async ({
    page,
  }) => {
    // Every mutating button now shows a native confirm() — Playwright
    // auto-dismisses dialogs unless a handler is registered.
    page.on("dialog", (dialog) => dialog.accept());

    await test.step("customer requests a vehicle with both maps links filled in", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);
      await page.getByRole("link", { name: "Araç Çağır" }).first().click();
      await expect(page).toHaveURL(/\/shipments\/request/);

      await page.getByLabel("Tedarikçi Firma").click();
      await page.getByRole("option", { name: fixture.supplierName }).click();
      await page
        .getByLabel("Yükleme Noktası", { exact: true })
        .fill("Kayseri");
      await page.getByLabel("Teslimat Noktası", { exact: true }).fill("Adana");
      await page.getByLabel("Yükleme Noktası Linki").fill(ORIGIN_MAPS_URL);
      await page
        .getByLabel("Teslimat Noktası Linki")
        .fill(DESTINATION_MAPS_URL);
      await page.getByLabel("Mesafe (km)").fill("330");
      await page.getByLabel("Tonaj (ton)").fill("5");
      await page.getByRole("button", { name: "Araç Çağır" }).click();

      // Matches the UUID shape specifically so this genuinely waits for the
      // post-submit redirect (see the identical fix in the other specs).
      await expect(page).toHaveURL(
        /\/shipments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
      );
    });

    await test.step("the Kapı Rezervasyonu card is visible to the customer immediately, before any assignment", async () => {
      await expect(page.getByText("Kapı Rezervasyonu")).toBeVisible();
      await expect(page.getByTestId("shipment-status-badge")).toHaveText(
        "Atama Bekliyor"
      );
      await assertNavigationLinks(page);

      const originLink = page
        .getByRole("link", { name: "Navigasyonu Başlat" })
        .first();
      await expect(originLink).toHaveAttribute("href", ORIGIN_MAPS_URL);
      const destinationLink = page
        .getByRole("link", { name: "Navigasyonu Başlat" })
        .last();
      await expect(destinationLink).toHaveAttribute(
        "href",
        DESTINATION_MAPS_URL
      );
    });

    const shipmentUrl = page.url();

    await logout(page, "E2E Customer User");

    await test.step("supplier sees the same links read-only, with no way to edit them", async () => {
      await login(page, fixture.email, fixture.password);
      await page.goto(shipmentUrl);

      await expect(page.getByText("Kapı Rezervasyonu")).toBeVisible();
      await assertNavigationLinks(page);
      await expect(
        page.getByRole("link", { name: "Navigasyonu Başlat" }).first()
      ).toHaveAttribute("href", ORIGIN_MAPS_URL);

      // No edit affordance of any kind near the Kapı Rezervasyonu section —
      // it is purely a read display for the supplier.
      const kapiCard = page
        .locator('[data-slot="card"]')
        .filter({ hasText: "Kapı Rezervasyonu" });
      await expect(
        kapiCard.getByRole("button", { name: /düzenle|değiştir/i })
      ).toHaveCount(0);
      await expect(kapiCard.locator("input")).toHaveCount(0);
    });
  });
});
