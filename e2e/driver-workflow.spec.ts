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
  // Redirect target differs by account type (/dashboard vs /driver), so
  // this can't wait for one specific URL like the other specs' login()
  // helpers do — but it must wait for SOMETHING, otherwise callers race
  // ahead of the login Server Action still being in flight and the next
  // navigation hits proxy.ts as still-unauthenticated (bounced to
  // /login?callbackUrl=... instead of the intended page).
  await expect(page).not.toHaveURL(/\/login/);
}

async function logout(page: Page, fullName: string) {
  await page.getByRole("button", { name: new RegExp(fullName) }).click();
  await page.getByRole("menuitem", { name: "Çıkış Yap" }).click();
  await expect(page).toHaveURL(/\/login/);
}

test.describe("Driver login and self-service status updates", () => {
  test.beforeAll(() => {
    runFixtureScript("e2e/fixtures/setup.ts", RUN_ID);
    fixture = JSON.parse(
      readFileSync(path.join(__dirname, `.fixture-${RUN_ID}.json`), "utf-8")
    );
  });

  test.afterAll(() => {
    runFixtureScript("e2e/fixtures/cleanup.ts", RUN_ID);
  });

  test("driver lands on /driver, is kept out of /dashboard, and can advance a shipment through to completion", async ({
    page,
  }) => {
    // This is the longest, most action-dense spec in the suite (full
    // request -> assign -> price -> 4-step driver lifecycle) and now also
    // triggers the most confirm() dialogs of any spec (assign, price
    // approval, and all 4 driver status advances) — each one a real
    // CDP round-trip even auto-accepted. The global 60s budget is tuned for
    // shorter specs; this one needs more headroom.
    test.setTimeout(120_000);

    // Every mutating button now shows a native confirm() — Playwright
    // auto-dismisses dialogs unless a handler is registered.
    page.on("dialog", (dialog) => dialog.accept());

    let shipmentUrl = "";

    await test.step("customer requests a vehicle", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);
      await expect(page).toHaveURL(/\/dashboard/);
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

      // Matches the UUID shape specifically so this genuinely waits for the
      // post-submit redirect (same fix as the other specs).
      await expect(page).toHaveURL(
        /\/shipments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
      );
      shipmentUrl = page.url();
    });

    await logout(page, "E2E Customer User");

    await test.step("supplier assigns the pre-seeded vehicle/driver with a price, then departs", async () => {
      await login(page, fixture.email, fixture.password);
      await expect(page).toHaveURL(/\/dashboard/);
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

    await test.step("customer approves the price", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);
      await page.goto(shipmentUrl);
      await page.getByRole("button", { name: "Fiyatı Onayla" }).click();
      await expect(page.getByText("Onaylandı", { exact: true })).toBeVisible();
    });

    await logout(page, "E2E Customer User");

    await test.step("supplier sends the vehicle off (HEADING_TO_PICKUP)", async () => {
      await login(page, fixture.email, fixture.password);
      await page.goto(shipmentUrl);
      await page.getByRole("button", { name: "Yüklemeye Gidiyor" }).click();
      await expect(page.getByTestId("shipment-status-badge")).toHaveText(
        "Yüklemeye Gidiyor"
      );
    });

    await logout(page, "E2E Dispatcher");

    await test.step("driver logs in and lands on /driver, not /dashboard", async () => {
      await login(page, fixture.driverEmail, fixture.password);
      await expect(page).toHaveURL(/\/driver/);
      await expect(page.getByText("Seferlerim")).toBeVisible();
    });

    await test.step("driver is bounced back to /driver if they try /dashboard directly", async () => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/driver/);
    });

    await test.step("driver sees the assigned shipment and advances it through to completion", async () => {
      await page.goto("/driver");
      await expect(page.getByText("Denizli → Isparta")).toBeVisible();

      await page
        .getByRole("button", { name: "Yükleme Noktasına Vardım" })
        .click();
      await expect(page.getByText("Yüklemede", { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Depo Kapısına Vardım" }).click();
      await expect(
        page.getByText("Yüklemeye Hazır", { exact: true })
      ).toBeVisible();

      // Leaving the pickup point requires a photo — the server rejects the
      // transition without one (see advanceShipmentStatusAsDriver).
      await page
        .getByLabel("Yükleme Fotoğrafı (zorunlu)")
        .setInputFiles({
          name: "yukleme.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.from("fake-jpeg-bytes"),
        });
      await page
        .getByRole("button", { name: "Malı Teslim Aldım, Yola Çıkıyorum" })
        .click();
      await expect(page.getByText("Yolda", { exact: true })).toBeVisible();

      await page
        .getByRole("button", { name: "Teslimat Noktasına Vardım" })
        .click();
      await expect(
        page.getByText("Teslimat Noktasında", { exact: true })
      ).toBeVisible();

      await page.getByRole("button", { name: "Malı Teslim Ettim" }).click();
      // The shipment leaves the driver's active list once COMPLETED.
      await expect(
        page.getByText("Şu anda size atanmış aktif bir sefer bulunmuyor.")
      ).toBeVisible();
    });

    await logout(page, fixture.driverName);

    await test.step("both customer and supplier were notified of the driver's progress", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);
      await expect(page).toHaveURL(/\/dashboard/);
      const customerBell = page.getByRole("button", { name: "Bildirimler" });
      await customerBell.click();
      // notifyDriverCompletedDelivery's customer-facing message is
      // "Malınız teslim edildi." (no company name) — "teslim edildi" is a
      // unique enough substring not to collide with the other notification
      // messages already in this customer's inbox by this point (e.g.
      // PRICE_PROPOSED's "...teklif edildi." or DRIVER_DEPARTED_PICKUP's
      // "...teslim aldı...").
      await expect(page.getByText(/teslim edildi/i)).toBeVisible();
      // Radix's DropdownMenu is modal by default and aria-hides the rest of
      // the page while open — unlike the other specs, this step never
      // clicks a specific notification Link (whose onClick closes the
      // menu as a side effect), so it has to close the menu explicitly or
      // the next logout()'s getByRole lookup for the user button won't
      // find it.
      await page.keyboard.press("Escape");
    });

    await logout(page, "E2E Customer User");

    await test.step("company user (customer) is bounced away from /driver", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);
      await page.goto("/driver");
      await expect(page).toHaveURL(/\/dashboard/);
    });

    await logout(page, "E2E Customer User");

    await test.step("supplier's own view also reflects the driver-driven completion", async () => {
      await login(page, fixture.email, fixture.password);
      await page.goto(shipmentUrl);
      await expect(page.getByTestId("shipment-status-badge")).toHaveText(
        "Tamamlandı"
      );
    });
  });
});
