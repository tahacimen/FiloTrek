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
  password: string;
  vehiclePlate: string;
  driverName: string;
};

async function logout(page: Page, fullName: string) {
  await page.getByRole("button", { name: new RegExp(fullName) }).click();
  // DropdownMenuItem (Radix) renders role="menuitem", not "button", even
  // though the underlying element is a <button type="submit">.
  await page.getByRole("menuitem", { name: "Çıkış Yap" }).click();
  await expect(page).toHaveURL(/\/login/);
}

test.describe("Customer vehicle request reaches the right supplier as a notification", () => {
  test.beforeAll(() => {
    runFixtureScript("e2e/fixtures/setup.ts", RUN_ID);
    fixture = JSON.parse(
      readFileSync(path.join(__dirname, `.fixture-${RUN_ID}.json`), "utf-8")
    );
  });

  test.afterAll(() => {
    runFixtureScript("e2e/fixtures/cleanup.ts", RUN_ID);
  });

  test("customer requests a vehicle, supplier is notified, assigns it", async ({
    page,
  }) => {
    // Every mutating button now shows a native confirm() — Playwright
    // auto-dismisses dialogs unless a handler is registered.
    page.on("dialog", (dialog) => dialog.accept());

    await test.step("customer logs in and requests a vehicle from the chosen supplier", async () => {
      await page.goto("/login");
      await page.getByLabel("E-posta").fill(fixture.customerUserEmail);
      await page.getByLabel("Şifre").fill(fixture.password);
      await page.getByRole("button", { name: "Giriş Yap" }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      await page.getByRole("link", { name: "Araç Çağır" }).first().click();
      await expect(page).toHaveURL(/\/shipments\/request/);

      await page.getByLabel("Tedarikçi Firma").click();
      await page.getByRole("option", { name: fixture.supplierName }).click();
      await page.getByLabel("Yükleme Noktası", { exact: true }).fill("Bursa");
      await page
        .getByLabel("Teslimat Noktası", { exact: true })
        .fill("Konya");
      await page.getByLabel("Mesafe (km)").fill("380");
      await page.getByLabel("Tonaj (ton)").fill("6");
      await page.getByRole("button", { name: "Araç Çağır" }).click();

      // Matches the UUID shape specifically (not just [a-z0-9-]+) so this
      // genuinely waits for the post-submit redirect rather than passing
      // immediately against the still-current /shipments/request slug,
      // which would otherwise also satisfy a looser pattern.
      await expect(page).toHaveURL(
        /\/shipments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
      );
      await expect(page.getByTestId("shipment-status-badge")).toHaveText(
        "Atama Bekliyor"
      );
    });

    await logout(page, "E2E Customer User");

    await test.step("supplier logs in and sees the request as a notification", async () => {
      await page.goto("/login");
      await page.getByLabel("E-posta").fill(fixture.email);
      await page.getByLabel("Şifre").fill(fixture.password);
      await page.getByRole("button", { name: "Giriş Yap" }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      const bell = page.getByRole("button", { name: "Bildirimler" });
      await expect(bell.getByText("1")).toBeVisible();
      await bell.click();

      const notificationText = page.getByText(
        new RegExp(`${fixture.customerName}.*Bursa.*Konya`)
      );
      await expect(notificationText).toBeVisible();
      await notificationText.click();

      await expect(page).toHaveURL(/\/assign/);
    });

    await test.step("supplier assigns the requested vehicle and driver", async () => {
      const row = page
        .getByTestId("pending-shipment-row")
        .filter({ hasText: "Bursa" });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "Ata" }).click();

      await page.getByLabel("Araç", { exact: true }).click();
      await page
        .getByRole("option", { name: new RegExp(fixture.vehiclePlate) })
        .click();
      await page.getByLabel("Şoför", { exact: true }).click();
      await page.getByRole("option", { name: fixture.driverName }).click();
      await page.getByLabel("Nakliye Fiyatı").fill("21000");
      await page.getByRole("button", { name: "Sefere Ata" }).click();

      await expect(page.getByTestId("pending-shipment-row")).toHaveCount(0);
    });

    await test.step("shipment now shows ASSIGNED with the vehicle/driver attached", async () => {
      await page.goto("/shipments");
      await page.getByRole("link", { name: "Detay" }).first().click();

      await expect(page.getByTestId("shipment-status-badge")).toHaveText(
        "Atandı"
      );
      await expect(page.getByText(fixture.vehiclePlate)).toBeVisible();
      await expect(page.getByText(fixture.driverName)).toBeVisible();
      // The PENDING -> ASSIGNED bug-fix guard shouldn't block legitimate
      // further steps: the next real transition should still be offered.
      await expect(
        page.getByRole("button", { name: "Yüklemeye Gidiyor" })
      ).toBeVisible();
    });
  });
});
