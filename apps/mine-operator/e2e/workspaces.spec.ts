import { expect, test } from "@playwright/test";
import { openAs, setPlan, signIn } from "./support";

test.describe("workspaces and subscriptions", () => {
  test.skip(({ isMobile }) => isMobile, "Exercised on the desktop layout.");

  const openApp = openAs;

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
    await page.getByRole("cell", { name: "Crusher Line" }).click();
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
    await expect(page.getByText("5 of 6")).toBeVisible();
    await page.getByRole("link", { name: /Delay analytics/ }).click();
    await expect(page.getByRole("heading", { name: /Advanced analytics are part of Enterprise and Group/ })).toBeVisible();

    await setPlan(page, "Enterprise");
    await page.goto("/reports/delay-analytics");
    await expect(page.getByRole("heading", { name: "Delay analytics", level: 1 })).toBeVisible();
    await expect(page.getByText("Indicative trend data. Not measured delay")).toBeVisible();
  });

  test("includes VESPER Mobile in every subscription, Core included", async ({ page }) => {
    await signIn(page);
    for (const plan of ["Core", "Operations — Single Site", "Operations", "Enterprise", "Group"]) {
      await setPlan(page, plan);
      await page.goto("/mobile/my-shift");
      await expect(page.getByRole("heading", { name: /Good morning/ }), plan).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Field navigation" }), plan).toBeVisible();
    }
  });

  test("shows each subscription's site allowance from the central plans, with Group from its contract", async ({ page }) => {
    const expected: Record<string, string> = { Core: "1 site", "Operations — Single Site": "1 site", Operations: "Up to 3 sites", Enterprise: "Up to 6 sites", Group: "10 sites (contracted)" };
    await signIn(page);
    for (const [plan, sites] of Object.entries(expected)) {
      await setPlan(page, plan);
      await page.goto("/admin");
      await page.getByRole("tab", { name: "Plan and usage" }).click();
      await expect(page.getByRole("heading", { name: plan, exact: true }), plan).toBeVisible();
      await expect(page.getByText(sites, { exact: true }).first(), plan).toBeVisible();
    }
  });

  test("keeps every operational record when the subscription changes", async ({ page }) => {
    await signIn(page);
    await page.goto("/exceptions/new");
    await page.getByLabel("Issue title").fill("Conveyor belt mistracking");
    await page.getByLabel("Observed condition").fill("The feed conveyor belt is mistracking to the left side.");
    await page.getByRole("button", { name: "Record issue" }).click();
    await expect(page.getByRole("heading", { name: "Conveyor belt mistracking" })).toBeVisible();

    for (const plan of ["Core", "Enterprise", "Operations — Single Site", "Group", "Operations"]) {
      await setPlan(page, plan);
      await page.goto("/exceptions");
      await expect(page.getByText("Conveyor belt mistracking").first(), plan).toBeVisible();
      await expect(page.getByText(/Crusher C-02/).first(), plan).toBeVisible();
    }
  });

  test("shows the client their own plan, people and connections, not every tier", async ({ page }) => {
    await openApp(page, "/admin");
    await expect(page.getByRole("cell", { name: /Amina Patel amina\.patel@/ })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await page.getByRole("tab", { name: "Plan and usage" }).click();
    await expect(page.getByRole("heading", { name: "Operations — Single Site" })).toBeVisible();
    await page.getByRole("tab", { name: "Connections" }).click();
    await expect(page.getByText("Maintenance system")).toBeVisible();
    await expect(page.getByText("Not connected").first()).toBeVisible();
  });
});
