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
  await expect(page).not.toHaveURL(/\/login/);
}

async function logout(page: Page, fullName: string) {
  await page.getByRole("button", { name: new RegExp(fullName) }).click();
  await page.getByRole("menuitem", { name: "Çıkış Yap" }).click();
  await expect(page).toHaveURL(/\/login/);
}

test.describe("Price negotiation: reject with a counter-offer, other side accepts", () => {
  test.beforeAll(() => {
    runFixtureScript("e2e/fixtures/setup.ts", RUN_ID);
    fixture = JSON.parse(
      readFileSync(path.join(__dirname, `.fixture-${RUN_ID}.json`), "utf-8")
    );
  });

  test.afterAll(() => {
    runFixtureScript("e2e/fixtures/cleanup.ts", RUN_ID);
  });

  test("customer counters, supplier accepts, the shipment can then depart", async ({
    page,
  }) => {
    // Every mutating button now shows a native confirm() — Playwright
    // auto-dismisses dialogs unless a handler is registered.
    page.on("dialog", (dialog) => dialog.accept());

    let shipmentUrl = "";

    await test.step("customer requests a vehicle", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);
      await page.getByRole("link", { name: "Araç Çağır" }).first().click();
      await expect(page).toHaveURL(/\/shipments\/request/);

      await page.getByLabel("Tedarikçi Firma").click();
      await page.getByRole("option", { name: fixture.supplierName }).click();
      await page
        .getByLabel("Yükleme Noktası", { exact: true })
        .fill("Denizli");
      await page
        .getByLabel("Teslimat Noktası", { exact: true })
        .fill("Isparta");
      await page.getByLabel("Mesafe (km)").fill("120");
      await page.getByLabel("Tonaj (ton)").fill("4");
      await page.getByRole("button", { name: "Araç Çağır" }).click();

      await expect(page).toHaveURL(
        /\/shipments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
      );
      shipmentUrl = page.url();
    });

    await logout(page, "E2E Customer User");

    await test.step("supplier assigns with an initial price", async () => {
      await login(page, fixture.email, fixture.password);
      await page.goto("/assign");
      const row = page
        .getByTestId("pending-shipment-row")
        .filter({ hasText: "Denizli" });
      await row.getByRole("button", { name: "Ata" }).click();
      await page.getByLabel("Araç", { exact: true }).click();
      await page
        .getByRole("option", { name: new RegExp(fixture.vehiclePlate) })
        .click();
      await page.getByLabel("Şoför", { exact: true }).click();
      await page.getByRole("option", { name: fixture.driverName }).click();
      await page.getByLabel("Nakliye Fiyatı").fill("9500");
      await page.getByRole("button", { name: "Sefere Ata" }).click();
      await expect(page.getByTestId("pending-shipment-row")).toHaveCount(0);
    });

    await logout(page, "E2E Dispatcher");

    await test.step("customer rejects with a counter-offer", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);
      await page.goto(shipmentUrl);
      await expect(page.getByText("9.500", { exact: false })).toBeVisible();
      await expect(page.getByText("Onay Bekliyor")).toBeVisible();

      await page.getByRole("button", { name: "Reddet" }).click();
      await page
        .getByLabel("Önerdiğiniz Fiyat (₺, opsiyonel)")
        .fill("8000");
      await page.getByRole("button", { name: "Reddi Gönder" }).click();

      await expect(page.getByText("8.000", { exact: false })).toBeVisible();
      await expect(page.getByText("Onay Bekliyor")).toBeVisible();
    });

    await logout(page, "E2E Customer User");

    await test.step("supplier sees the customer's counter-offer and accepts it", async () => {
      await login(page, fixture.email, fixture.password);
      await page.goto(shipmentUrl);
      await expect(page.getByText("8.000", { exact: false })).toBeVisible();

      await page.getByRole("button", { name: "Fiyatı Onayla" }).click();
      await expect(page.getByText("Onaylandı", { exact: true })).toBeVisible();
    });

    await test.step("the negotiated price unblocks departure", async () => {
      await page.getByRole("button", { name: "Yüklemeye Gidiyor" }).click();
      await expect(page.getByTestId("shipment-status-badge")).toHaveText(
        "Yüklemeye Gidiyor"
      );
    });
  });
});
