/**
 * Browser test (Playwright, desktop Chrome). Administration: tabs that live in the address, grouped, and the Automations tab: seven
 * notification rules the Mine Manager switches on, aims and runs. Rules only notify; nothing leaves VESPER. Runs against a production build.
 */
import { expect, test } from "@playwright/test";
import { actAs, openAs, pick } from "./support";

test.describe("administration tabs", () => {
  test.skip(({ isMobile }) => isMobile, "Administration is exercised on the desktop layout.");

  test("keep your place: each tab is in the address, so a refresh and the back button return to it", async ({ page }) => {
    await openAs(page, "/admin");
    const tabs = page.getByRole("tablist", { name: "Administration sections" });
    for (const name of ["Employees", "User rights", "Site", "Company", "Service providers", "Automations", "Plan and usage", "Connections"]) await expect(tabs.getByRole("tab", { name })).toBeVisible();
    await tabs.getByRole("tab", { name: "Automations" }).click();
    await expect(page).toHaveURL(/\/admin\?tab=automations$/);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Automations", level: 2 })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: "Automations" })).toHaveAttribute("aria-selected", "true");
    await page.goto("/admin?tab=site");
    await expect(tabs.getByRole("tab", { name: "Site" })).toHaveAttribute("aria-selected", "true");
    // The plan summary belongs on Employees and Plan and usage, not on every tab.
    await expect(page.getByRole("region", { name: "Summary" })).toHaveCount(0);
    await page.goto("/admin?tab=plan");
    await expect(page.getByRole("region", { name: "Summary" })).toBeVisible();
    await page.goto("/admin?tab=nonsense");
    await expect(tabs.getByRole("tab", { name: "Employees" })).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("automations", () => {
  test.skip(({ isMobile }) => isMobile, "Administration is exercised on the desktop layout.");

  test("lists the seven rules, all off, with who they tell and what is in the history", async ({ page }) => {
    await openAs(page, "/admin?tab=automations");
    const list = page.getByRole("list", { name: "Automations" });
    await expect(list.getByRole("listitem")).toHaveCount(7);
    for (const name of ["Service due soon or overdue", "Issue with no owner", "Overdue action", "Handover not sent", "Shipment waiting on transport", "Vehicle problem on a planned load", "Provider approval ending"]) await expect(list).toContainText(name);
    await expect(page.getByRole("switch", { name: "Service due soon or overdue: off" })).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Run all rules now" })).toBeDisabled();
    await expect(page.getByText("They never change a record, approve or send anything.")).toBeVisible();
    await expect(page.getByText("Nothing has run yet")).toBeVisible();
  });

  test("switches a rule on, runs it, and the person it tells receives notifications that link to the records", async ({ page }) => {
    test.slow();
    await openAs(page, "/admin?tab=automations");
    await page.getByRole("switch", { name: "Service due soon or overdue: off" }).click();
    await expect(page.getByRole("switch", { name: "Service due soon or overdue: on" })).toBeChecked();
    await page.getByRole("button", { name: "Run all rules now" }).click();
    await expect(page.getByText(/notifications? sent/).first()).toBeVisible();
    const history = page.getByRole("list", { name: "Automation history" });
    await expect(history).toContainText(/Service due soon or overdue: \d+ found, \d+ notified/);
    await expect(history).toContainText("switched on");
    // A second run announces nothing new.
    await page.getByRole("button", { name: "Run Service due soon or overdue now" }).click();
    await expect(page.getByText("Nothing new to announce").first()).toBeVisible();
    await expect(history).toContainText("already announced");

    // The planner was told, and the notification opens the asset.
    await actAs(page, "Lebo Maseko");
    await page.goto("/overview");
    await page.getByRole("button", { name: /Notifications/ }).click();
    const popover = page.locator(".notification-popover");
    await expect(popover).toContainText("Service due soon or overdue");
    await expect(popover.getByRole("link").filter({ hasText: /HT-102/ }).first()).toHaveAttribute("href", /\/equipment\/eq-ht102/);
  });

  test("changes who is told and how early a rule counts, and refuses values out of range", async ({ page }) => {
    test.slow();
    await openAs(page, "/admin?tab=automations");
    const item = page.getByRole("listitem").filter({ hasText: "Service due soon or overdue" });
    await pick(item.getByRole("combobox", { name: /^Tell/ }), "Mine Manager");
    await expect(page.getByRole("list", { name: "Automation history" })).toContainText("now tells Mine Manager");
    const days = item.getByLabel(/Tell me this many days ahead/);
    await days.fill("0");
    await days.blur();
    await expect(page.getByText(/between 1 and 60/).first()).toBeVisible();
    await days.fill("21");
    await days.blur();
    await expect(page.getByRole("list", { name: "Automation history" })).toContainText("21 days");
  });

  test("is for the Mine Manager only", async ({ page }) => {
    await openAs(page, "/admin?tab=automations", "Lebo Maseko");
    await expect(page.getByRole("heading", { name: /Administration is for the Mine Manager/ })).toBeVisible();
  });
});
