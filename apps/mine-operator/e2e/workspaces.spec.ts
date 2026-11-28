/**
 * Browser test (Playwright, desktop Chrome and a phone). The registers, reports, map legend and subscriptions: what each plan shows and hides.
 * Runs against a production build; see playwright.config.ts and scripts/run-e2e.mjs.
 */
import { expect, test } from "@playwright/test";
import { openAs, setPlan, signIn } from "./support";

test.describe("workspaces and subscriptions", () => {
  test.skip(({ isMobile }) => isMobile, "Exercised on the desktop layout.");

  const openApp = openAs;

  test("shows live registers with their own summaries and filters", async ({ page }) => {
    await openApp(page, "/exceptions");
    await expect(page.getByRole("heading", { name: "Work & Exceptions", level: 1 })).toBeVisible();
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

  test("keeps the account menu to the web app: workspaces and administration, no link out to VESPER Mobile", async ({ page }) => {
    await signIn(page);
    await page.goto("/overview");
    await page.getByRole("button", { name: /Account menu/ }).click();
    const menu = page.getByRole("group", { name: "Account menu" });
    await expect(menu.getByRole("link", { name: /Administration/ })).toBeVisible();
    await expect(menu.getByText(/VESPER Mobile/)).toHaveCount(0);
  });

  test("shows each subscription's site allowance from the central plans, with Group from its contract", async ({ page }) => {
    const expected: Record<string, string> = { Core: "1 site", "Operations — Single Site": "1 site", Operations: "Up to 3 sites", Enterprise: "Up to 6 sites", Group: "10 sites (licensed)" };
    await signIn(page);
    for (const [plan, sites] of Object.entries(expected)) {
      await setPlan(page, plan);
      await page.goto("/admin");
      await page.getByRole("tab", { name: "Plan and usage" }).click();
      await expect(page.getByRole("heading", { name: plan, exact: true }), plan).toBeVisible();
      await expect(page.getByText(sites, { exact: true }).first(), plan).toBeVisible();
    }
  });

  test("gives Core operational visibility and keeps the Operations coordination capabilities for Operations", async ({ page }) => {
    await signIn(page);
    await setPlan(page, "Core");
    await page.goto("/overview");
    const sidebar = page.getByRole("navigation", { name: "Primary workspaces" });
    await expect(sidebar.getByRole("link", { name: "Equipment & Maintenance" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Resource Readiness" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Shift handover" })).toHaveCount(0);
    await expect(page.getByText("Readiness risks")).toHaveCount(0);

    // Resource Readiness, detailed handovers, maintenance coordination and detailed reports are not part of Core.
    await page.goto("/resources");
    await expect(page.getByRole("heading", { name: /Resource Readiness and spare-parts early warning is not part of your subscription/ })).toBeVisible();
    await page.goto("/shifts/shift-a-20250424/handover");
    await expect(page.getByRole("heading", { name: /Detailed shift handovers is not part of your subscription/ })).toBeVisible();
    await page.goto("/reports");
    await expect(page.getByText("2 of 6")).toBeVisible();
    await page.goto("/reports/equipment-delay-stages");
    await expect(page.getByRole("heading", { name: /Detailed operational reports are part of Operations/ })).toBeVisible();

    // What Core does include stays: equipment details, issues, shifts and tasks.
    await page.goto("/equipment/eq-ex204");
    await expect(page.getByRole("heading", { name: "Details" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Maintenance plans" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Service history" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Downtime" })).toHaveCount(0);
    await page.goto("/shifts/shift-a-20250424");
    await expect(page.getByRole("heading", { name: "Work", exact: true })).toBeVisible();
    await expect(page.getByText("Handover", { exact: true })).toHaveCount(0);
    await page.goto("/exceptions");
    await expect(page.getByRole("heading", { name: "Work & Exceptions", level: 1 })).toBeVisible();

    // Operations, with the same screens, has the coordination capabilities.
    await setPlan(page, "Operations");
    await page.goto("/overview");
    await expect(page.getByRole("navigation", { name: "Primary workspaces" }).getByRole("link", { name: "Resource Readiness" })).toBeVisible();
    await page.goto("/equipment/eq-ex204");
    await expect(page.getByRole("heading", { name: "Maintenance plans" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Downtime" })).toBeVisible();
    await page.goto("/shifts/shift-a-20250424/handover");
    await expect(page.getByRole("heading", { name: "Handover", exact: true })).toBeVisible();
    await page.goto("/reports/equipment-delay-stages");
    await expect(page.getByRole("heading", { name: "Delay stages", level: 1 })).toBeVisible();
  });

  test("gives Operations - Single Site and Operations identical functionality", async ({ page }) => {
    await signIn(page);
    const seen: Record<string, string[]> = {};
    for (const plan of ["Operations — Single Site", "Operations"]) {
      await setPlan(page, plan);
      await page.goto("/overview");
      const links = await page.getByRole("navigation", { name: "Primary workspaces" }).getByRole("link").allInnerTexts();
      await page.goto("/reports");
      const reports = await page.getByText(/\d of \d/).first().innerText();
      seen[plan] = [...links.map((text) => text.replace(/\d+$/, "").trim()), reports];
    }
    expect(seen["Operations — Single Site"]).toEqual(seen["Operations"]);
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
