import { expect, test } from "@playwright/test";

test("launches a clearly labelled simulated command centre", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByText("DEMO / SIMULATED DATA").first()).toBeVisible();
  await page.getByRole("button", { name: "Enter demonstration" }).click();
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole("heading", { name: /Crusher C-02/ })).toBeVisible();
  await expect(page.getByText("Opportunity not quantified")).toBeVisible();
});

test("opens the canonical issue and preserves verification separation", async ({ page }) => {
  await page.goto("/overview");
  await page.getByRole("link", { name: /View details/i }).click();
  await expect(page).toHaveURL(/\/exceptions\/issue-riv-001$/);
  await expect(page.getByText(/Repair completion, independent verification/)).toBeVisible();
});

test("opens an account menu instead of switching to the mobile layout", async ({ page, isMobile }) => {
  test.skip(isMobile, "The account menu is exercised on the desktop layout.");
  await page.goto("/overview");
  await page.getByRole("button", { name: /Account menu for John Dlamini/ }).click();
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole("group", { name: "Account menu" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary workspaces" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("group", { name: "Account menu" })).toBeHidden();
});

test("switching to a field persona opens the field experience, and back again", async ({ page, isMobile }) => {
  test.skip(isMobile, "Persona switching is exercised on the desktop layout.");
  await page.goto("/overview");
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("button", { name: /Thabo Molefe/ }).click();
  await expect(page).toHaveURL(/\/mobile\/my-shift$/);
  await expect(page.getByRole("heading", { name: /Good morning, Thabo/ })).toBeVisible();
  await page.getByRole("button", { name: /Account menu for Thabo Molefe/ }).click();
  await page.getByRole("link", { name: /Back to desktop view/ }).click();
  await expect(page).toHaveURL(/\/overview$/);
});

test("searches records from the keyboard", async ({ page, isMobile }) => {
  test.skip(isMobile, "Keyboard search is exercised on the desktop layout.");
  await page.goto("/overview");
  await expect(page.getByRole("heading", { name: /Crusher C-02/ })).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: /Search records/ }).fill("riv-2025-041");
  await expect(page.getByRole("option", { name: /Crusher C-02/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/exceptions\/issue-riv-001$/);
});

test("shows an actionable empty state when search finds nothing", async ({ page, isMobile }) => {
  test.skip(isMobile, "Keyboard search is exercised on the desktop layout.");
  await page.goto("/overview");
  await expect(page.getByRole("heading", { name: /Crusher C-02/ })).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: /Search records/ }).fill("zzzz-nothing");
  await expect(page.getByText(/Nothing matches/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Search VESPER" })).toBeHidden();
});

test("shows the field report as pending while demo offline", async ({ page }) => {
  await page.goto("/mobile/report");
  await page.getByRole("button", { name: "Simulate offline" }).click();
  await page.getByLabel("Issue title").fill("Hydraulic leak observed");
  await page.getByLabel("Observed condition").fill("A small hydraulic leak was observed during the fictional pre-start inspection.");
  await page.getByRole("button", { name: "Save pending report" }).click();
  await expect(page.getByText("Pending Synchronisation")).toBeVisible();
  await expect(page.getByText(/has not been received centrally/)).toBeVisible();
});
