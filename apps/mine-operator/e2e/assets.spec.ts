/**
 * Browser test (Playwright, desktop Chrome and a phone). Assets: the Equipment and Infrastructure tabs of one register, per-tab figures,
 * filters and search, adding infrastructure, and how an unavailable asset shows what depends on it and reaches VESPER Intelligence.
 * Infrastructure records are simulated demonstration data.
 */
import { expect, test } from "@playwright/test";
import { actAs, openAs, pick } from "./support";

test.describe("assets", () => {
  test("the page is called Assets, keeps Equipment & Maintenance in the sidebar, and has two tabs", async ({ page }) => {
    await openAs(page, "/equipment");
    await expect(page.getByRole("heading", { name: "Assets", level: 1 })).toBeVisible();
    await expect(page.getByRole("complementary").getByRole("link", { name: "Equipment & Maintenance" })).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Asset type" });
    await expect(tabs.getByRole("link", { name: "Equipment" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("row", { name: /Primary Crusher C-02/ })).toContainText("Unavailable");
    // Infrastructure does not appear on the Equipment tab.
    await expect(page.getByRole("row", { name: /Main Substation SUB-01/ })).toHaveCount(0);
    await expect(page.getByText("Equipment assets")).toBeVisible();
  });

  test("the Infrastructure tab has its own figures, columns and category filters", async ({ page }) => {
    await openAs(page, "/equipment");
    await page.getByRole("navigation", { name: "Asset type" }).getByRole("link", { name: "Infrastructure" }).click();
    await expect(page).toHaveURL(/tab=infrastructure/);
    await expect(page.getByText("Infrastructure assets")).toBeVisible();
    await expect(page.locator(".kpi", { hasText: "Infrastructure assets" })).toContainText("7");
    await expect(page.locator(".kpi", { hasText: "Unavailable" })).toContainText("0");
    for (const heading of ["Infrastructure asset", "Category", "Area / location", "Status", "Next service", "Hours / usage"]) await expect(page.locator("th", { hasText: heading }).first()).toBeAttached();
    const sub = page.getByRole("row", { name: /Main Substation SUB-01/ });
    await expect(sub).toContainText("Power");
    await expect(sub).toContainText("Plant Area");
    await expect(page.getByRole("row", { name: /Process Water Pump PWP-03/ })).toContainText("Needs attention");
    await expect(page.getByRole("row", { name: /Process Water Pump PWP-03/ })).toContainText("6,240");
    await expect(page.getByRole("row", { name: /Primary Crusher C-02/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Water", exact: true }).click();
    await expect(page.getByRole("row", { name: /PWP-03/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /TP-01/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /SUB-01/ })).toHaveCount(0);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByPlaceholder("Search this list").fill("conveyor");
    await expect(page.getByRole("row", { name: /CV-07/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /SUB-01/ })).toHaveCount(0);
  });

  test("adds infrastructure from the Add asset menu, with a location, responsible person, condition and dependency", async ({ page }) => {
    test.slow();
    await openAs(page, "/equipment?tab=infrastructure", "Lebo Maseko");
    await page.getByRole("button", { name: "Add asset" }).click();
    await page.getByRole("button", { name: "Add infrastructure" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add infrastructure" })).toBeVisible();
    await dialog.getByLabel("Name").fill("Dewatering Pump DP-02");
    await dialog.getByLabel("Asset code").fill("DP-02");
    await pick(dialog.getByRole("combobox", { name: /^Category/ }), "Pump");
    await dialog.getByLabel("Location").fill("Water Plant");
    await pick(dialog.getByRole("combobox", { name: /^Responsible person/ }), "Lebo Maseko");
    await pick(dialog.getByRole("combobox", { name: /^Condition/ }), "Needs attention");
    await dialog.getByLabel("Usage measure").fill("1,200 m³ pumped");
    await dialog.getByRole("checkbox", { name: /SUB-01/ }).check();
    await dialog.getByRole("button", { name: "Add infrastructure" }).click();
    await expect(page.getByText("Asset added").first()).toBeVisible();
    await expect(page).toHaveURL(/\/equipment\/eq-dp-02$/);
    await expect(page.getByRole("heading", { name: "Dewatering Pump DP-02" })).toBeVisible();
    const details = page.getByRole("article").filter({ hasText: "Details" }).first();
    await expect(details).toContainText("Water Plant");
    await expect(details).toContainText("Lebo Maseko");
    await expect(details).toContainText("Needs attention");
    await expect(page.getByRole("article", { name: /Depends on and affects/ })).toContainText("SUB-01");
  });

  test("an unavailable substation shows what depends on it, and VESPER Intelligence names it without estimating money", async ({ page }) => {
    test.slow();
    await openAs(page, "/equipment/eq-sub-01", "Lebo Maseko");
    const deps = page.getByRole("article", { name: /Depends on and affects/ });
    await expect(deps).toContainText("Needed by");
    await expect(deps).toContainText("Primary Crusher C-02");
    await expect(deps).toContainText("Conveyor CV-07");
    await page.getByRole("button", { name: "Update availability" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Unavailable").check();
    await dialog.getByLabel("Reason").click();
    await page.getByRole("option", { name: "Electrical or control fault" }).click();
    await dialog.getByLabel("Details").fill("Transformer fault reported at 07:10.");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(deps).toContainText("SUB-01 is reported unavailable");
    await expect(deps).toContainText("affects C-02, CV-07");
    await expect(deps).toContainText("No production or financial impact is estimated");
    // The dependent asset says what it is waiting on.
    await page.goto("/equipment/eq-cv-07");
    await expect(page.getByRole("article", { name: /Depends on and affects/ })).toContainText("SUB-01 is reported unavailable");

    await actAs(page, "John Dlamini");
    await page.goto("/overview");
    const panel = page.getByRole("article", { name: /VESPER Intelligence/ });
    await expect(panel).toContainText("Dependent assets affected");
    await expect(panel).toContainText("C-02, CV-07 depend on it");
    await expect(panel.getByRole("link", { name: "Open asset" })).toHaveAttribute("href", "/equipment/eq-sub-01");
  });
});
