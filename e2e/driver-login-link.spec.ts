import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
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

test.describe("Driver login link (password-free access)", () => {
  test.beforeAll(() => {
    runFixtureScript("e2e/fixtures/setup.ts", RUN_ID);
    fixture = JSON.parse(
      readFileSync(path.join(__dirname, `.fixture-${RUN_ID}.json`), "utf-8")
    );
  });

  test.afterAll(() => {
    runFixtureScript("e2e/fixtures/cleanup.ts", RUN_ID);
    rmSync(path.join(__dirname, `.login-token-${RUN_ID}.json`), {
      force: true,
    });
  });

  test("dispatcher sends a driver a login link, and the driver reaches /driver by following it without a password", async ({
    page,
  }) => {
    // Every mutating button now shows a native confirm() — Playwright
    // auto-dismisses dialogs unless a handler is registered.
    page.on("dialog", (dialog) => dialog.accept());

    await test.step("dispatcher sends the link from the drivers list", async () => {
      await login(page, fixture.email, fixture.password);
      await page.goto("/drivers");
      const row = page.getByRole("row").filter({ hasText: fixture.driverName });
      await row
        .getByRole("button", { name: "Giriş Bağlantısı Gönder" })
        .click();
    });

    let loginToken: string | null = null;
    await test.step("fetch the generated token (stands in for 'reading the email', since SMTP isn't configured in this environment)", async () => {
      // Poll briefly: the click above fires a Server Action whose email/DB
      // write may not have committed the instant the click handler returns.
      await expect(async () => {
        runFixtureScript(
          "e2e/fixtures/get-driver-login-token.ts",
          RUN_ID,
          fixture.driverEmail
        );
        const data = JSON.parse(
          readFileSync(
            path.join(__dirname, `.login-token-${RUN_ID}.json`),
            "utf-8"
          )
        );
        expect(data.loginToken).toEqual(expect.any(String));
        loginToken = data.loginToken;
      }).toPass({ timeout: 15_000 });
    });

    await logout(page, "E2E Dispatcher");

    await test.step("following the link signs the driver in and lands on /driver, no password typed", async () => {
      await page.goto(`/api/driver-login/${loginToken}`);
      await expect(page).toHaveURL(/\/driver/);
      await expect(page.getByText("Seferlerim")).toBeVisible();
    });

    await logout(page, fixture.driverName);

    await test.step("an invalid token is rejected", async () => {
      const response = await page.goto("/api/driver-login/not-a-real-token");
      expect(response?.status()).toBe(404);
    });
  });
});
