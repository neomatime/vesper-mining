/**
 * Browser test (Playwright, desktop Chrome and a phone). Manage Service Providers: the directory with its figures, search, filters and
 * pagination; adding, viewing, editing, approving, deactivating and deleting a provider; and the rule that a provider repair requests
 * refer to is deactivated, never deleted. Providers are fictional demonstration records.
 */
import { expect, test } from "@playwright/test";
import { actAs, openAs, pick } from "./support";

test.describe("manage service providers", () => {
  test("opens from Assets, with a breadcrumb back, and shows the four figures", async ({ page }) => {
    await openAs(page, "/equipment");
    await page.getByRole("link", { name: "Manage Service Providers" }).click();
    await expect(page).toHaveURL(/\/equipment\/providers$/);
    await expect(page.getByRole("heading", { name: "Manage Service Providers", level: 1 })).toBeVisible();
    await expect(page.locator(".kpi", { hasText: "Service providers" })).toContainText("12");
    await expect(page.locator(".kpi", { hasText: "Approved" })).toContainText("9");
    await expect(page.locator(".kpi", { hasText: "Pending approval" })).toContainText("2");
    await expect(page.locator(".kpi", { hasText: "Inactive" })).toContainText("1");
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs).toContainText("Equipment & Maintenance");
    await crumbs.getByRole("link", { name: "Equipment & Maintenance" }).click();
    await expect(page.getByRole("heading", { name: "Assets", level: 1 })).toBeVisible();
  });

  test("searches, filters and pages through the providers, with an empty state", async ({ page }) => {
    await openAs(page, "/equipment/providers");
    await expect(page.getByText("Showing 5 of 12 service providers")).toBeVisible();
    await page.getByRole("button", { name: "Page 2" }).click();
    await expect(page.getByText("Showing 5 of 12 service providers")).toBeVisible();
    await page.getByRole("button", { name: "Page 3" }).click();
    await expect(page.getByText("Showing 2 of 12 service providers")).toBeVisible();

    await page.getByLabel("Search service providers").fill("hydraulics");
    await expect(page.getByRole("row", { name: /Mining Hydraulics SA/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Ridge Hydraulics/ })).toBeVisible();
    await expect(page.getByText("Showing 2 of 2 service providers")).toBeVisible();
    await page.getByLabel("Search service providers").fill("");

    await pick(page.getByRole("combobox", { name: /^Status/ }), "Pending approval");
    await expect(page.getByRole("row", { name: /AquaFlow Solutions/ })).toContainText("Pending approval");
    await expect(page.getByRole("row", { name: /Rail & Loading Engineering/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /ABC Industrial Repairs/ })).toHaveCount(0);

    await page.getByLabel("Search service providers").fill("zzzz");
    await expect(page.getByText("No service providers match these filters")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText("Showing 5 of 12 service providers")).toBeVisible();
  });

  test("the Maintenance Planner adds a provider, who is pending until the Mine Manager approves it", async ({ page }) => {
    test.slow();
    await openAs(page, "/equipment/providers", "Lebo Maseko");
    await page.getByRole("button", { name: "Add Service Provider" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Company name").fill("Delta Hoist Services");
    await dialog.getByLabel("Company registration number").fill("2021/000777/07");
    await dialog.getByLabel("Contact person").fill("Sam Dube");
    await dialog.getByLabel("Email address").fill("sam@deltahoist.example");
    await dialog.getByLabel("Phone").fill("+27 11 555 0100");
    await dialog.getByLabel("Service specialisation").fill("Hoists and conveyor drives");
    await dialog.getByLabel("Expected response time (hours)").fill("6");
    await dialog.getByRole("checkbox", { name: "Conveyor" }).check();
    // A planner cannot choose the approval status.
    await expect(dialog.getByLabel("Approval status")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Add provider" }).click();
    await expect(page.getByText("Service provider added").first()).toBeVisible();
    await page.getByLabel("Search service providers").fill("delta hoist");
    const row = page.getByRole("row", { name: /Delta Hoist Services/ });
    await expect(row).toContainText("Pending approval");
    await expect(row).toContainText("Within 6 hours");
    await row.getByRole("button", { name: /Actions for Delta Hoist Services/ }).click();
    await expect(page.getByRole("link", { name: "View details" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // The same name or registration number is refused.
    await page.getByRole("button", { name: "Add Service Provider" }).click();
    await page.getByRole("dialog").getByLabel("Company name").fill("Delta Hoist Services");
    await page.getByRole("dialog").getByLabel("Company registration number").fill("2021/000999/07");
    await page.getByRole("dialog").getByLabel("Service specialisation").fill("Hoists");
    await page.getByRole("dialog").getByRole("checkbox", { name: "Conveyor" }).check();
    await page.getByRole("dialog").getByRole("button", { name: "Add provider" }).click();
    await expect(page.getByText("A provider with this name is already on the list.").first()).toBeVisible();
  });

  test("the Mine Manager approves, deactivates with a reason, and the provider's page keeps the audit trail", async ({ page }) => {
    test.slow();
    await openAs(page, "/equipment/providers");
    await page.getByLabel("Search service providers").fill("aquaflow");
    await page.getByRole("row", { name: /AquaFlow Solutions/ }).getByRole("button", { name: /Actions for AquaFlow/ }).click();
    await page.getByRole("button", { name: "Approve" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText("Provider approved").first()).toBeVisible();
    await expect(page.getByRole("row", { name: /AquaFlow Solutions/ })).toContainText("Approved");

    await page.getByRole("row", { name: /AquaFlow Solutions/ }).getByRole("link", { name: /AquaFlow Solutions/ }).click();
    await expect(page.getByRole("heading", { name: "AquaFlow Solutions", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Manage Service Providers");
    await expect(page.getByRole("article", { name: /History of changes/ })).toContainText("Approval changed from pending approval to approved");
    await expect(page.getByRole("article", { name: /Maintenance agreements/ })).toContainText("No maintenance agreements recorded");
    await expect(page.getByRole("article", { name: /Repair history and performance/ })).toContainText("No recorded replies yet");
    await page.getByRole("button", { name: "Make inactive" }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Make inactive" })).toBeDisabled();
    await page.getByRole("dialog").getByLabel("Why? (required)").fill("Insurance cover has lapsed.");
    await page.getByRole("dialog").getByRole("button", { name: "Make inactive" }).click();
    await expect(page.getByText("Provider made inactive").first()).toBeVisible();
    await expect(page.getByRole("article", { name: /History of changes/ })).toContainText("Insurance cover has lapsed.");
    await expect(page.getByText(/cannot be given new repair requests/)).toBeVisible();
  });

  test("deletes an unreferenced provider after confirming, but never one that repair requests refer to", async ({ page }) => {
    test.slow();
    await openAs(page, "/equipment/providers", "Lebo Maseko");
    // Lebo (planner) asks OreTech to quote, so OreTech now has history.
    await page.goto("/equipment/eq-crusher-c02");
    await page.getByRole("link", { name: /Request service/ }).first().click();
    await page.getByLabel("Fault / issue").fill("500 hour inspection");
    await page.getByRole("radio", { name: /Request quotation/ }).check();
    await pick(page.getByLabel("Priority"), "Urgent");
    await page.getByRole("checkbox", { name: /OreTech Services/ }).check();
    await page.getByRole("button", { name: "Send Repair Request" }).click();
    await expect(page.getByRole("heading", { name: "500 hour inspection", level: 1 })).toBeVisible();

    await actAs(page, "John Dlamini");
    await page.goto("/equipment/providers");
    await page.getByLabel("Search service providers").fill("oretech");
    await page.getByRole("row", { name: /OreTech Services/ }).getByRole("button", { name: /Actions for OreTech/ }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete provider" }).click();
    await expect(page.getByRole("dialog")).toContainText("cannot be deleted");
    await expect(page.getByRole("dialog")).toContainText(/SR-/);
    await page.getByRole("button", { name: "Deactivate instead" }).click();
    await page.getByRole("dialog").getByLabel("Why? (required)").fill("Paused while the contract is renewed.");
    await page.getByRole("dialog").getByRole("button", { name: "Make inactive" }).click();
    await expect(page.getByRole("row", { name: /OreTech Services/ })).toContainText("Inactive");

    // An unreferenced provider is deleted after a confirmation.
    await page.getByLabel("Search service providers").fill("terrain");
    await page.getByRole("row", { name: /Terrain Works/ }).getByRole("button", { name: /Actions for Terrain/ }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).toContainText("cannot be undone");
    await page.getByRole("dialog").getByRole("button", { name: "Delete provider" }).click();
    await expect(page.getByText("Service provider deleted").first()).toBeVisible();
    await expect(page.getByRole("row", { name: /Terrain Works/ })).toHaveCount(0);
  });
});
