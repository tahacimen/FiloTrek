import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const RUN_ID = String(Date.now());
const GATE_GUARD_EMAIL = `e2e-gate-guard-${RUN_ID}@test.local`;
const GATE_GUARD_PASSWORD = "GateGuard1!";

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

test.describe("Nizamiye: gate guard logs vehicle entry/exit", () => {
  test.beforeAll(() => {
    runFixtureScript("e2e/fixtures/setup.ts", RUN_ID);
    fixture = JSON.parse(
      readFileSync(path.join(__dirname, `.fixture-${RUN_ID}.json`), "utf-8")
    );
  });

  test.afterAll(() => {
    runFixtureScript("e2e/fixtures/cleanup.ts", RUN_ID);
  });

  test("customer creates a gate guard, who logs vehicle entry then exit with timestamps", async ({
    page,
  }) => {
    // Every mutating button now shows a native confirm() — Playwright
    // auto-dismisses dialogs unless a handler is registered.
    page.on("dialog", (dialog) => dialog.accept());

    await test.step("customer requests a vehicle and supplier assigns it", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);
      await page.getByRole("link", { name: "Araç Çağır" }).first().click();
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

      await logout(page, "E2E Customer User");

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
      await logout(page, "E2E Dispatcher");
    });

    await test.step("customer admin creates a gate guard account", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);
      await page.goto("/gate-guards");
      await page
        .getByRole("button", { name: "Yeni Nizamiye Kullanıcısı" })
        .click();
      await page.getByLabel("Ad Soyad").fill("E2E Nizamiye");
      await page.getByLabel("E-posta").fill(GATE_GUARD_EMAIL);
      await page.getByLabel("Şifre").fill(GATE_GUARD_PASSWORD);
      await page.getByRole("button", { name: "Ekle" }).click();
      await expect(page.getByText("E2E Nizamiye")).toBeVisible();

      await logout(page, "E2E Customer User");
    });

    await test.step("gate guard logs in and lands on /gate, not /dashboard", async () => {
      await login(page, GATE_GUARD_EMAIL, GATE_GUARD_PASSWORD);
      await expect(page).toHaveURL(/\/gate/);
      await expect(page.getByText("Denizli → Isparta")).toBeVisible();
      await expect(page.getByText("Dışarıda")).toBeVisible();
    });

    await test.step("gate guard is bounced back to /gate if they try /dashboard directly", async () => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/gate/);
    });

    await test.step("gate guard logs a vehicle entry, with a timestamp shown", async () => {
      await page.goto("/gate");
      await page.getByRole("button", { name: "Araç Giriş Yaptı" }).click();
      await expect(page.getByText("Çıkış Bekleniyor")).toBeVisible();
      await expect(page.getByText("Giriş Saati")).toBeVisible();
    });

    await test.step("gate guard logs the vehicle's exit — it becomes terminal and moves to Tamamlanan Kayıtlar", async () => {
      await page.getByRole("button", { name: "Araç Çıkış Yaptı" }).click();
      await expect(page.getByText("Tamamlanan Kayıtlar")).toBeVisible();
      await expect(page.getByText("Çıkış Saati")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Araç Giriş Yaptı" })
      ).toBeDisabled();
    });

    await logout(page, "E2E Nizamiye");

    await test.step("customer admin sees the gate activity in their notification bell", async () => {
      await login(page, fixture.customerUserEmail, fixture.password);
      const bell = page.getByRole("button", { name: "Bildirimler" });
      await bell.click();
      await expect(page.getByText(/giriş yaptığını bildirdi/i)).toBeVisible();
      await expect(page.getByText(/çıkış yaptığını bildirdi/i)).toBeVisible();
    });
  });
});
