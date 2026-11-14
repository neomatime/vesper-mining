import { expect, test, type Page } from "@playwright/test";
import { actAs, openAs, pick } from "./support";

test.describe("equipment management", () => {
  test.skip(({ isMobile }) => isMobile, "Equipment management is exercised on the desktop layout.");

  const dialog = (page: Page) => page.getByRole("dialog");

  async function addTruck(page: Page, code = "ht 301", name = "Haul Truck HT-301") {
    await page.getByRole("button", { name: "Add equipment" }).first().click();
    await dialog(page).getByLabel("Name").fill(name);
    await dialog(page).getByLabel("Asset code").fill(code);
    await pick(dialog(page).getByLabel("Category"), "Haul truck");
    await pick(dialog(page).getByLabel("Operating area"), { label: "Central Pit" });
    await dialog(page).getByLabel("Average hours per day").fill("14");
    await dialog(page).getByLabel("Current meter reading").fill("1200");
    await dialog(page).getByRole("button", { name: "Add equipment" }).click();
  }

  test("adds equipment, sets up maintenance, and keeps service history", async ({ page }) => {
    await openAs(page, "/equipment", "Lebo Maseko");
    await addTruck(page);
    await expect(page.getByRole("heading", { name: "Haul Truck HT-301" })).toBeVisible();
    await expect(page.getByText("1,200 hours").first()).toBeVisible();
    await expect(page.getByText("No maintenance plans yet")).toBeVisible();

    await page.getByRole("button", { name: "Add plan" }).first().click();
    await dialog(page).getByLabel("Plan name").fill("500 hour service");
    await dialog(page).getByLabel("Interval (hours)").fill("500");
    await dialog(page).getByLabel("Hours at the last service").fill("1000");
    await dialog(page).getByRole("button", { name: "Add plan" }).click();
    await expect(page.getByText("Due in 21 days").first()).toBeVisible();

    await page.getByRole("button", { name: "Record reading" }).click();
    await dialog(page).getByLabel("Operating hours on the meter").fill("1450");
    await dialog(page).getByRole("button", { name: "Record reading" }).click();
    await expect(page.getByText("1,450 hours").first()).toBeVisible();
    await expect(page.getByText("Due in 4 days").first()).toBeVisible();

    await page.getByRole("button", { name: "Log service" }).first().click();
    await dialog(page).getByLabel("What was done").fill("500 hour service done, filters and oil changed.");
    await pick(dialog(page).getByLabel("Completes this plan"), { label: "500 hour service" });
    await dialog(page).getByLabel("Meter reading (hours)").fill("1500");
    await dialog(page).getByLabel("Work order reference").fill("CMMS-WO-3001");
    await dialog(page).getByRole("button", { name: "Log entry" }).click();
    await expect(page.getByRole("cell", { name: /500 hour service done/ })).toBeVisible();
    await expect(page.getByRole("cell", { name: "CMMS-WO-3001" })).toBeVisible();
    await expect(page.getByText("Due in 36 days").first()).toBeVisible();
  });

  test("edits details and keeps unique asset codes", async ({ page }) => {
    await openAs(page, "/equipment/eq-dz017", "Lebo Maseko");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await dialog(page).getByLabel("Name").fill("Track Dozer DZ-017 (north)");
    await pick(dialog(page).getByLabel("Operating area"), { label: "North Pit" });
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: "Track Dozer DZ-017 (north)" })).toBeVisible();
    await expect(page.getByText(/Updated name, area/)).toBeVisible();

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await dialog(page).getByLabel("Asset code").fill("ex-204");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/already used by another piece of equipment/)).toBeVisible();
  });

  test("reports availability with a reason and never marks it verified", async ({ page }) => {
    await openAs(page, "/equipment/eq-ex204", "Lebo Maseko");
    await page.getByRole("button", { name: "Update availability" }).click();
    await dialog(page).getByLabel("Unavailable").check();
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page).getByText("Choose the closest reason.")).toBeVisible();
    await expect(dialog(page).getByText("Add at least eight characters.")).toBeVisible();
    await dialog(page).getByLabel("Reason").click();
    await page.getByRole("option", { name: "Mechanical fault" }).click();
    await dialog(page).getByLabel("Details").fill("Hydraulic leak at the boom cylinder.");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Unavailable" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Recent downtime periods" })).toContainText("Mechanical fault");
    await expect(page.getByText(/Reported · /)).toBeVisible();
  });

  test("lets the meter go down only as a correction", async ({ page }) => {
    await openAs(page, "/equipment/eq-ex204", "Lebo Maseko");
    await page.getByRole("button", { name: "Record reading" }).click();
    await dialog(page).getByLabel("Operating hours on the meter").fill("700");
    await dialog(page).getByRole("button", { name: "Record reading" }).click();
    await expect(dialog(page).getByText(/lower than the last reading/)).toBeVisible();
    await dialog(page).getByLabel(/This corrects an earlier reading/).check();
    await dialog(page).getByLabel("Why is it being corrected").fill("The last reading was keyed in wrongly.");
    await dialog(page).getByRole("button", { name: "Record reading" }).click();
    await expect(page.getByText("700 hours").first()).toBeVisible();
  });

  test("retires, restores and protects history from deletion", async ({ page }) => {
    await openAs(page, "/equipment", "Lebo Maseko");
    await addTruck(page, "HT-302", "Haul Truck HT-302");
    await expect(page.getByRole("heading", { name: "Haul Truck HT-302" })).toBeVisible();

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: /Retire/ }).click();
    await dialog(page).getByLabel("Why is it being retired").fill("Sold to another operator.");
    await dialog(page).getByRole("button", { name: "Retire equipment" }).click();
    await expect(page.getByText(/This record is read-only/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Log service" })).toHaveCount(0);

    await page.goto("/equipment");
    await page.getByRole("button", { name: "Retired" }).click();
    await expect(page.getByText("Haul Truck HT-302")).toBeVisible();
    await page.getByRole("link", { name: /Haul Truck HT-302/ }).click();

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: /Restore/ }).click();
    await expect(page.getByText(/Equipment restored/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Log service" }).first()).toBeVisible();

    // Retiring and restoring is recorded activity, so this one can no longer be deleted.
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: /Delete/ }).click();
    await dialog(page).getByRole("button", { name: "Delete equipment" }).click();
    await expect(page.getByText(/recorded activity/)).toBeVisible();
  });

  test("deletes a record made in error", async ({ page }) => {
    await openAs(page, "/equipment", "Lebo Maseko");
    await addTruck(page, "HT-303", "Haul Truck HT-303");
    await expect(page.getByRole("heading", { name: "Haul Truck HT-303" })).toBeVisible();
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: /Delete/ }).click();
    await dialog(page).getByRole("button", { name: "Delete equipment" }).click();
    await expect(page).toHaveURL(/\/equipment$/);
    await expect(page.getByText("Haul Truck HT-303")).toHaveCount(0);
  });

  test("will not retire equipment with open work", async ({ page }) => {
    await openAs(page, "/equipment/eq-crusher-c02", "Lebo Maseko");
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: /Retire/ }).click();
    await dialog(page).getByLabel("Why is it being retired").fill("End of its working life.");
    await dialog(page).getByRole("button", { name: "Retire equipment" }).click();
    await expect(page.getByText(/RIV-2025-041/).first()).toBeVisible();
    await expect(page.getByText(/This record is read-only/)).toHaveCount(0);
  });

  test("keeps each role to what it may do", async ({ page }) => {
    await openAs(page, "/equipment", "Amina Patel");
    await expect(page.getByRole("heading", { name: "Equipment", level: 1 })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add equipment" })).toHaveCount(0);
    await page.goto("/equipment/eq-dz017");
    await expect(page.getByRole("button", { name: "Log service" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add plan" })).toHaveCount(0);

    await actAs(page, "Thabo Molefe");
    await page.goto("/equipment/eq-dz017");
    await expect(page.getByRole("button", { name: "Record reading" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log service" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Update availability" })).toHaveCount(0);
  });

  test("starts an issue from the equipment with it already chosen", async ({ page }) => {
    await openAs(page, "/equipment/eq-ex204");
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("group", { name: "More actions" }).getByRole("link", { name: /Report an issue/ }).click();
    await expect(page).toHaveURL(/exceptions\/new\?equipmentId=eq-ex204/);
    await expect(page.getByRole("combobox", { name: "Equipment", exact: true })).toContainText("Hydraulic Excavator EX-204");
  });

  test("shows new equipment in search and as a choice when reporting an issue", async ({ page }) => {
    await openAs(page, "/equipment", "Lebo Maseko");
    await addTruck(page, "HT-304", "Haul Truck HT-304");
    await expect(page.getByRole("heading", { name: "Haul Truck HT-304" })).toBeVisible();
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: /Search records/ }).fill("ht-304");
    await expect(page.getByRole("option", { name: /Haul Truck HT-304/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/exceptions/new");
    await page.getByLabel("Equipment").click();
    await expect(page.getByRole("listbox").getByRole("option", { name: "Haul Truck HT-304" })).toBeVisible();
  });
});
