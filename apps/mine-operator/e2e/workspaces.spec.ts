import { expect, test, type Page } from "@playwright/test";

test.describe("workspaces and subscriptions", () => {
  test.skip(({ isMobile }) => isMobile, "Exercised on the desktop layout.");

  async function openApp(page: Page, path: string) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: /Account menu/ })).toBeVisible();
  }

  async function choosePlan(page: Page, name: "Enterprise" | "Operations") {
    await page.goto("/admin");
    await page.getByRole("radio", { name: new RegExp(`^${name} (Sites|Current)`) }).click();
    await expect(page.getByText(`Subscription set to ${name}`, { exact: true })).toBeVisible();
  }

  test("shows live registers with their own summaries and filters", async ({ page }) => {
    await openApp(page, "/exceptions");
    await expect(page.getByRole("heading", { name: "Operational constraints" })).toBeVisible();
    await expect(page.getByText("Open issues")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Waiting on" })).toBeVisible();

    await page.getByRole("link", { name: /Awaiting dependency/ }).first().click();
    await expect(page).toHaveURL(/filter=waiting/);
    await expect(page.getByText("Crusher C-02 — Feed Interruption")).toBeVisible();
    await expect(page.getByText("Central Pit — Reduced Output")).toBeHidden();
  });

  test("opens a record from anywhere in its table row", async ({ page }) => {
    await openApp(page, "/equipment");
    await page.getByRole("cell", { name: "Verify spare-part availability" }).click();
    await expect(page).toHaveURL(/\/equipment\/eq-crusher-c02$/);
  });

  test("explains map colours with a legend", async ({ page }) => {
    await openApp(page, "/map");
    await expect(page.getByRole("list", { name: "Status legend" })).toBeVisible();
    await expect(page.getByText("Verified information confirms a blocking condition.")).toBeVisible();
  });

  test("gives each report its own content", async ({ page }) => {
    await openApp(page, "/reports/operational-exceptions");
    await expect(page.getByRole("heading", { name: "Operational exceptions", level: 1 })).toBeVisible();
    await expect(page.getByRole("cell", { name: /RIV-2025-041/ })).toBeVisible();

    await page.goto("/reports/resource-readiness");
    await expect(page.getByRole("heading", { name: "Resource readiness", level: 1 })).toBeVisible();
    await expect(page.getByRole("row", { name: /OEM engine oil pack.*Unknown/ })).toBeVisible();
  });

  test("keeps advanced analytics for Enterprise and Group", async ({ page }) => {
    await openApp(page, "/reports");
    await expect(page.getByText("4 of 5")).toBeVisible();
    await page.getByRole("link", { name: /Delay analytics/ }).click();
    await expect(page.getByRole("heading", { name: /Advanced analytics are part of Enterprise and Group/ })).toBeVisible();

    await choosePlan(page, "Enterprise");
    await page.goto("/reports/delay-analytics");
    await expect(page.getByRole("heading", { name: "Delay analytics", level: 1 })).toBeVisible();
    await expect(page.getByText("Illustrative fixture. Not measured delay")).toBeVisible();
  });

  test("keeps VESPER Mobile out of Core and brings it back on Operations", async ({ page }) => {
    await openApp(page, "/admin");
    await page.getByRole("radio", { name: "Core" }).click();
    await expect(page.getByText(/VESPER Mobile is no longer included/)).toBeVisible();

    await page.getByRole("button", { name: /Account menu/ }).click();
    await expect(page.getByText(/Not included in Core/)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/mobile/my-shift");
    await expect(page.getByRole("heading", { name: /VESPER Mobile is not part of this subscription/ })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Field navigation" })).toHaveCount(0);

    await choosePlan(page, "Operations");
    await page.goto("/mobile/my-shift");
    await expect(page.getByRole("heading", { name: /Good morning/ })).toBeVisible();
  });

  test("lets only the Mine Manager change the plan, and lists integrations as not connected", async ({ page }) => {
    await openApp(page, "/admin");
    await expect(page.getByText("Maintenance system (CMMS)")).toBeVisible();
    await expect(page.getByText("Not connected").first()).toBeVisible();

    await page.getByRole("button", { name: "View as Amina" }).click();
    await page.goto("/admin");
    await expect(page.getByRole("radio", { name: "Core" })).toBeDisabled();
    await expect(page.getByText(/The Mine Manager changes the plan/)).toBeVisible();
  });
});
