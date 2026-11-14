/**
 * Browser test (Playwright, desktop Chrome and a phone). The environment-selection entry page and its way into sign-in.
 * Runs against a production build; see playwright.config.ts and scripts/run-e2e.mjs.
 */
import { expect, test } from "@playwright/test";

test.describe("environment selection", () => {
  test("is the entry page, and does not send the visitor on to sign in by itself", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Select an Environment" })).toBeVisible();
    await expect(page.getByText("Choose where you’d like to access VESPER.")).toBeVisible();
    await expect(page.getByText("For authorised VESPER users only.")).toBeVisible();
    await expect(page.getByLabel("Email address")).toHaveCount(0);
  });

  test("offers both environments, with the live one reaching this deployment's sign-in", async ({ page }) => {
    await page.goto("/");
    const production = page.getByRole("link", { name: /Production Environment/ });
    await expect(production).toContainText("LIVE");
    await expect(production).toHaveAttribute("href", "/sign-in");
    // UAT has no address configured here, so it is shown but never routed to a place it does not belong.
    const uat = page.locator('[data-environment="uat"]');
    await expect(uat).toContainText("UAT Environment");
    await expect(uat).toContainText("TEST");
    await expect(uat).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("link", { name: /UAT Environment/ })).toHaveCount(0);
  });

  test("is reachable by keyboard, and leads to the existing sign-in with a way back", async ({ page }) => {
    await page.goto("/");
    const production = page.getByRole("link", { name: /Production Environment/ });
    await expect(production).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(production).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Production Environment · LIVE")).toBeVisible();
    await page.getByRole("link", { name: "← Change environment" }).click();
    await expect(page.getByRole("heading", { name: "Select an Environment" })).toBeVisible();
  });

  test("fits the viewport without sideways scrolling", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const box = await page.getByRole("link", { name: /Production Environment/ }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
