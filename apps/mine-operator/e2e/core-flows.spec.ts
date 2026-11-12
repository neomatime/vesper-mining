import { expect, test } from "@playwright/test";
import { openAs, signIn, signInHere } from "./support";

test("signs in, shows no prototype labels, and lands on the command centre", async ({ page }) => {
  await page.goto("/");
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
  await signIn(page, "Thabo Molefe");
  await expect(page).toHaveURL(/\/mobile\/my-shift$/);
  await expect(page.getByRole("heading", { name: /Good morning, Thabo/ })).toBeVisible();
  await page.getByRole("button", { name: /Account menu for Thabo Molefe/ }).click();
  await page.getByRole("button", { name: /Sign out/ }).click();
  await signIn(page, "Naledi Khoza");
  await expect(page).toHaveURL(/\/resources$/);
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

test("shows the field report as pending while offline", async ({ page }) => {
  await openAs(page, "/mobile/report");
  await page.getByRole("button", { name: "Work offline" }).click();
  await page.getByLabel("Issue title").fill("Hydraulic leak observed");
  await page.getByLabel("Observed condition").fill("A small hydraulic leak was observed during the pre-start inspection.");
  await page.getByRole("button", { name: "Save pending report" }).click();
  await expect(page.getByText("Pending Synchronisation")).toBeVisible();
  await expect(page.getByText(/has not been received centrally/)).toBeVisible();
});

test("continues with Microsoft using a work address, and explains when the address is not known", async ({ page }) => {
  await page.goto("/sign-in");
  const button = page.getByRole("button", { name: "Continue with Microsoft" });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator(".signin__error")).toContainText("Enter your work email address");
  await page.getByLabel("Email address").fill("nobody@riverside.example");
  await button.click();
  await expect(page.locator(".signin__error")).toContainText("No VESPER account matches");
  await page.getByLabel("Email address").fill("john.dlamini@riverside.example");
  await button.click();
  await expect(page).toHaveURL(/\/overview/);
});
