import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const RUN_ID = String(Date.now());
const MAPS_URL = "https://maps.google.com/?q=41.0082,28.9784";

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

test.describe("Load-ready pickup info + navigation link, end to end across both roles", () => {
  test.beforeAll(() => {
    runFixtureScript("e2e/fixtures/setup.ts", RUN_ID);
    fixture = JSON.parse(
      readFileSync(path.join(__dirname, `.fixture-${RUN_ID}.json`), "utf-8")
    );
  });

  test.afterAll(() => {
    runFixtureScript("e2e/fixtures/cleanup.ts", RUN_ID);
  });

  test("customer submits load-ready info, supplier departs, customer sees the departure + navigation link", async ({
    page,
  }) => {
    // Every mutating button now shows a native confirm() — Playwright
    // auto-dismisses dialogs unless a handler is registered.
    page.on("dialog", (dialog) => dialog.accept());

    let shipmentUrl = "";

    await test.step("customer requests a vehicle with a document tracking number", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);
      await page.getByRole("link", { name: "Araç Çağır" }).first().click();
      await expect(page).toHaveURL(/\/shipments\/request/);

      await page.getByLabel("Tedarikçi Firma").click();
      await page.getByRole("option", { name: fixture.supplierName }).click();
      await page
        .getByLabel("Yükleme Noktası", { exact: true })
        .fill("Kayseri");
      await page.getByLabel("Teslimat Noktası", { exact: true }).fill("Adana");
      await page.getByLabel("Mesafe (km)").fill("330");
      await page.getByLabel("Tonaj (ton)").fill("5");
      await page
        .getByLabel("Belge Takip Numarası")
        .fill("IRS-E2E-00777");
      await page.getByRole("button", { name: "Araç Çağır" }).click();

      // Matches the UUID shape specifically (not just [a-z0-9-]+) so this
      // genuinely waits for the post-submit redirect rather than passing
      // immediately against the still-current /shipments/request slug,
      // which would otherwise also satisfy a looser pattern.
      await expect(page).toHaveURL(
        /\/shipments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
      );
      shipmentUrl = page.url();
      await expect(page.getByText("IRS-E2E-00777")).toBeVisible();
    });

    await logout(page, "E2E Customer User");

    await test.step("supplier assigns the pre-seeded vehicle and driver", async () => {
      await login(page, fixture.email, fixture.password);
      await page.goto("/assign");
      const row = page
        .getByTestId("pending-shipment-row")
        .filter({ hasText: "Kayseri" });
      await row.getByRole("button", { name: "Ata" }).click();
      await page.getByLabel("Araç", { exact: true }).click();
      await page
        .getByRole("option", { name: new RegExp(fixture.vehiclePlate) })
        .click();
      await page.getByLabel("Şoför", { exact: true }).click();
      await page.getByRole("option", { name: fixture.driverName }).click();
      await page.getByLabel("Nakliye Fiyatı").fill("27500");
      await page.getByRole("button", { name: "Sefere Ata" }).click();
      await expect(page.getByTestId("pending-shipment-row")).toHaveCount(0);
    });

    await logout(page, "E2E Dispatcher");

    await test.step("customer approves the proposed price, then marks the cargo ready with gate info and a Maps link", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);

      // Arrive via the PRICE_PROPOSED notification (rather than a direct
      // goto) so it's marked read here — otherwise it would still be
      // unread by the final step below, throwing off the unread count.
      const bell = page.getByRole("button", { name: "Bildirimler" });
      await bell.click();
      await page
        .getByText(new RegExp(`${fixture.supplierName}.*fiyat`, "i"))
        .click();
      await expect(page).toHaveURL(shipmentUrl);

      await page.getByRole("button", { name: "Fiyatı Onayla" }).click();
      await expect(page.getByText("Onaylandı", { exact: true })).toBeVisible();

      await page
        .getByRole("button", { name: "Yük Hazır, Aracı Gönder" })
        .click();
      await page
        .getByLabel("Kapı / Rampa Bilgisi")
        .fill("B Kapısı, 4 No'lu Rampa");
      await page.getByLabel(/Google Maps Konum Linki/).fill(MAPS_URL);
      await page.getByRole("button", { name: "Bildirimi Gönder" }).click();

      await expect(page.getByText("B Kapısı, 4 No'lu Rampa")).toBeVisible();
      const navLink = page.getByRole("link", { name: "Navigasyonu Başlat" });
      await expect(navLink).toBeVisible();
      await expect(navLink).toHaveAttribute("href", MAPS_URL);
      await expect(navLink).toHaveAttribute("target", "_blank");
    });

    await logout(page, "E2E Customer User");

    await test.step("supplier sees the load-ready notification, then marks the vehicle departed", async () => {
      await login(page, fixture.email, fixture.password);

      const bell = page.getByRole("button", { name: "Bildirimler" });
      await bell.click();
      await page
        .getByText(new RegExp(`${fixture.customerName}.*yük hazır`, "i"))
        .click();

      await expect(page).toHaveURL(shipmentUrl);
      await expect(
        page.getByRole("link", { name: "Navigasyonu Başlat" })
      ).toBeVisible();

      await page.getByRole("button", { name: "Yüklemeye Gidiyor" }).click();
      await expect(page.getByTestId("shipment-status-badge")).toHaveText(
        "Yüklemeye Gidiyor"
      );
    });

    await logout(page, "E2E Dispatcher");

    await test.step("customer is notified the vehicle departed and still sees the navigation link", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);

      const bell = page.getByRole("button", { name: "Bildirimler" });
      await expect(bell.getByText("1")).toBeVisible();
      await bell.click();
      await page
        .getByText(new RegExp(`${fixture.supplierName}.*yola çıktı`, "i"))
        .click();

      await expect(page).toHaveURL(shipmentUrl);
      // Same HEADING_TO_PICKUP status, but read from the customer's side:
      // the vehicle is arriving ("Geliyor"), not leaving ("Gidiyor") — see
      // customerShipmentStatusLabels in src/lib/labels.ts.
      await expect(page.getByTestId("shipment-status-badge")).toHaveText(
        "Yüklemeye Geliyor"
      );
      await expect(
        page.getByRole("link", { name: "Navigasyonu Başlat" })
      ).toHaveAttribute("href", MAPS_URL);
    });
  });
});
