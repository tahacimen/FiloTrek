import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Setup/teardown run as `tsx` subprocesses rather than importing the Prisma
// client directly: the generated client uses `import.meta.url`, which
// Playwright's own (CommonJS-oriented) test-file loader cannot execute,
// while `tsx` (already used for prisma/seed.ts) handles it natively.
// `.cmd` shims can't be spawned directly on Windows without a shell, so this
// builds a quoted command string for execSync instead of execFileSync.
const RUN_ID = String(Date.now());
const PLATE = `E2E ${RUN_ID}`.slice(0, 15);
const LICENSE = `E2ELIC${RUN_ID}`;

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
  customerCompanyId: string;
  customerName: string;
  email: string;
  customerUserEmail: string;
  password: string;
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
  // DropdownMenuItem (Radix) renders role="menuitem", not "button", even
  // though the underlying element is a <button type="submit">.
  await page.getByRole("menuitem", { name: "Çıkış Yap" }).click();
  await expect(page).toHaveURL(/\/login/);
}

test.describe("Golden path: login -> vehicle/driver -> shipment -> assign -> complete", () => {
  test.beforeAll(() => {
    runFixtureScript("e2e/fixtures/setup.ts", RUN_ID);
    fixture = JSON.parse(
      readFileSync(
        path.join(__dirname, `.fixture-${RUN_ID}.json`),
        "utf-8"
      )
    );
  });

  test.afterAll(() => {
    runFixtureScript("e2e/fixtures/cleanup.ts", RUN_ID);
  });

  test("completes the full dispatcher workflow", async ({ page }) => {
    // Every mutating button now shows a native confirm() — Playwright
    // auto-dismisses dialogs unless a handler is registered, so without
    // this every action below would silently no-op.
    page.on("dialog", (dialog) => dialog.accept());

    await test.step("login", async () => {
      await login(page, fixture.email, fixture.password);
    });

    await test.step("create a vehicle", async () => {
      await page.goto("/vehicles");
      await page.getByRole("button", { name: "Yeni Araç" }).click();
      await page.getByLabel("Plaka").fill(PLATE);
      await page.getByLabel("Araç Tipi").click();
      await page.getByRole("option", { name: "Kamyon", exact: true }).click();
      await page.getByLabel("Kasa Tipi").click();
      await page
        .getByRole("option", { name: "Kapalı Kasa", exact: true })
        .click();
      await page.getByLabel("Tonaj Kapasitesi").fill("10");
      await page.getByRole("button", { name: "Ekle" }).click();
      await expect(page.getByText(PLATE)).toBeVisible();
    });

    await test.step("create a driver", async () => {
      await page.goto("/drivers");
      await page.getByRole("button", { name: "Yeni Şoför" }).click();
      await page.getByLabel("Ad Soyad").fill("E2E Test Şoför");
      await page.getByLabel("Telefon").fill("0500 000 00 00");
      await page.getByLabel("Ehliyet Numarası").fill(LICENSE);
      await page.getByRole("button", { name: "Ekle" }).click();
      await expect(page.getByText("E2E Test Şoför")).toBeVisible();
    });

    await test.step("create a shipment", async () => {
      await page.goto("/shipments/new");
      await page.getByLabel("Müşteri Firma").click();
      await page.getByRole("option", { name: fixture.customerName }).click();
      await page.getByLabel("Yükleme Noktası").fill("İstanbul");
      await page.getByLabel("Teslimat Noktası").fill("Ankara");
      await page.getByLabel("Mesafe (km)").fill("450");
      await page.getByLabel("Tonaj (ton)").fill("8");
      await page.getByRole("button", { name: "Sefer Oluştur" }).click();
      // Matches the UUID shape specifically (not just [a-z0-9-]+) so this
      // genuinely waits for the post-submit redirect rather than passing
      // immediately against the still-current /shipments/new slug, which
      // would otherwise also satisfy a looser pattern.
      await expect(page).toHaveURL(
        /\/shipments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
      );
      await expect(page.getByTestId("shipment-status-badge")).toHaveText(
        "Atama Bekliyor"
      );
    });

    await test.step("assign vehicle and driver from the assignment screen", async () => {
      await page.goto("/assign");
      await expect(page.getByText("İstanbul → Ankara")).toBeVisible();
      const row = page
        .getByTestId("pending-shipment-row")
        .filter({ hasText: "İstanbul → Ankara" });
      await row.getByRole("button", { name: "Ata" }).click();
      await page.getByLabel("Araç", { exact: true }).click();
      await page.getByRole("option", { name: new RegExp(PLATE) }).click();
      await page.getByLabel("Şoför", { exact: true }).click();
      await page.getByRole("option", { name: "E2E Test Şoför" }).click();
      await page.getByLabel("Nakliye Fiyatı").fill("18500");
      await page.getByRole("button", { name: "Sefere Ata" }).click();
      await expect(page.getByTestId("pending-shipment-row")).toHaveCount(0);
    });

    let shipmentUrl = "";

    await test.step("customer approves the proposed price", async () => {
      await page.goto("/shipments");
      await page.getByRole("link", { name: "Detay" }).first().click();
      // Next.js client-side navigation doesn't trigger a browser-level
      // navigation event, so a click alone doesn't make Playwright wait for
      // it — page.url() read immediately after could still be the
      // pre-click URL. Wait for the real destination shape first.
      await expect(page).toHaveURL(
        /\/shipments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
      );
      shipmentUrl = page.url();

      await logout(page, "E2E Dispatcher");
      await login(page, fixture.customerUserEmail, fixture.password);
      await page.goto(shipmentUrl);
      await page.getByRole("button", { name: "Fiyatı Onayla" }).click();
      await expect(page.getByText("Onaylandı", { exact: true })).toBeVisible();
      await logout(page, "E2E Customer User");
    });

    await test.step("progress the shipment through to completion", async () => {
      await login(page, fixture.email, fixture.password);
      await page.goto(shipmentUrl);
      const statusBadge = page.getByTestId("shipment-status-badge");
      await expect(statusBadge).toHaveText("Atandı");

      await page.getByRole("button", { name: "Yüklemeye Gidiyor" }).click();
      await expect(statusBadge).toHaveText("Yüklemeye Gidiyor");

      await page.getByRole("button", { name: "Yüklemede" }).click();
      await expect(statusBadge).toHaveText("Yüklemede");

      await page.getByRole("button", { name: "Yüklemeye Hazır" }).click();
      await expect(statusBadge).toHaveText("Yüklemeye Hazır");

      await page.getByRole("button", { name: "Yolda" }).click();
      await expect(statusBadge).toHaveText("Yolda");

      await page.getByRole("button", { name: "Teslimat Noktasında" }).click();
      await expect(statusBadge).toHaveText("Teslimat Noktasında");

      await page.getByRole("button", { name: "Tamamlandı" }).click();
      await expect(statusBadge).toHaveText("Tamamlandı");
    });

    await test.step("vehicle and driver auto-release back to available", async () => {
      await page.goto("/vehicles");
      const vehicleRow = page.locator("tr", { hasText: PLATE });
      await expect(vehicleRow.getByText("Müsait")).toBeVisible();

      await page.goto("/drivers");
      const driverRow = page.locator("tr", { hasText: "E2E Test Şoför" });
      await expect(driverRow.getByText("Müsait")).toBeVisible();
    });

    await test.step("dashboard reflects the completed shipment", async () => {
      await page.goto("/dashboard");
      await expect(page.getByText("Toplam Araç")).toBeVisible();
    });
  });
});
