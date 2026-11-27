/**
 * Browser test (Playwright, desktop Chrome and a phone). The main journeys: entry page, sign-in, the Overview, reporting an issue and moving it through its lifecycle.
 * Runs against a production build; see playwright.config.ts and scripts/run-e2e.mjs.
 */
import { expect, test } from "@playwright/test";
import { FIXTURE_PASSWORD } from "../../../packages/core/src/lib/accounts";
import { openAs, signIn, signInHere } from "./support";

test("signs in, shows no prototype labels, and lands on the command centre", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Select an Environment" })).toBeVisible();
  await page.getByRole("link", { name: /Production Environment/ }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await signIn(page);
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole("heading", { name: /Crusher C-02/ })).toBeVisible();
  await expect(page.getByText("Opportunity not quantified")).toBeVisible();
  await expect(page.getByText(/demo|simulated/i)).toHaveCount(0);
  await expect(page.getByText("v3.0")).toHaveCount(0);
});

test("rejects a wrong password with a clear message", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("john.dlamini@riverside.example");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/do not match/)).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("sends signed-out visitors to sign in and returns them to where they were going", async ({ page }) => {
  await page.goto("/exceptions/issue-riv-001");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fexceptions%2Fissue-riv-001$/);
  await signInHere(page);
  await expect(page).toHaveURL(/\/exceptions\/issue-riv-001$/);
});

test("signs out from the account menu and protects the app afterwards", async ({ page, isMobile }) => {
  test.skip(isMobile, "The account menu is exercised on the desktop layout.");
  await openAs(page, "/overview");
  await page.getByRole("button", { name: /Account menu for John Dlamini/ }).click();
  await expect(page.getByRole("group", { name: "Account menu" })).toBeVisible();
  await expect(page).toHaveURL(/\/overview$/);
  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/overview");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Foverview$/);
});

test("starts each role where their work is", async ({ page, isMobile }) => {
  test.skip(isMobile, "Exercised on the desktop layout.");
  // A field employee works in VESPER Mobile, a separate app: signing in on the web sends them there.
  await page.route("http://127.0.0.1:3001/**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>VESPER Mobile</h1>" }));
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("thabo.molefe@riverside.example");
  await page.getByLabel("Password").fill(FIXTURE_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3001/my-shift");
  // Back on the web (the presenter page needs no session), end Thabo's session there and sign in as an office role.
  await page.goto("/demo");
  await page.evaluate(() => window.localStorage.clear());
  await signIn(page, "Naledi Khoza");
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByLabel("Summary").getByText("Readiness risks")).toBeVisible();
});

test("opens the canonical issue and preserves verification separation", async ({ page }) => {
  await openAs(page, "/overview");
  await page.getByRole("link", { name: /Review recovery actions/i }).click();
  await expect(page).toHaveURL(/\/exceptions\/issue-riv-001$/);
  await expect(page.getByText(/Repair completion, independent verification/)).toBeVisible();
});

test("searches records from the keyboard", async ({ page, isMobile }) => {
  test.skip(isMobile, "Keyboard search is exercised on the desktop layout.");
  await openAs(page, "/overview");
  await expect(page.getByRole("heading", { name: /Crusher C-02/ })).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: /Search records/ }).fill("riv-2025-041");
  await expect(page.getByRole("option", { name: /Crusher C-02/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/exceptions\/issue-riv-001$/);
});

test("shows an actionable empty state when search finds nothing", async ({ page, isMobile }) => {
  test.skip(isMobile, "Keyboard search is exercised on the desktop layout.");
  await openAs(page, "/overview");
  await expect(page.getByRole("heading", { name: /Crusher C-02/ })).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: /Search records/ }).fill("zzzz-nothing");
  await expect(page.getByText(/Nothing matches/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Search VESPER" })).toBeHidden();
});

test("continues with Microsoft using a work address, and explains when the address is not known", async ({ page }) => {
  await page.goto("/sign-in");
  const button = page.getByRole("button", { name: "Continue with Microsoft" });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator(".login__error")).toContainText("Enter your work email address");
  await page.getByLabel("Email address").fill("nobody@riverside.example");
  await button.click();
  await expect(page.locator(".login__error")).toContainText("No VESPER account matches");
  await page.getByLabel("Email address").fill("john.dlamini@riverside.example");
  await button.click();
  await expect(page).toHaveURL(/\/overview/);
});
