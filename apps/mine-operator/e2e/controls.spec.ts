import { expect, test, type Page } from "@playwright/test";
import { openAs, pick } from "./support";

test.describe("dropdowns, dates and times", () => {
  test.skip(({ isMobile }) => isMobile, "Form controls are exercised on the desktop layout.");

  const dialog = (page: Page) => page.getByRole("dialog");

  async function openAddEquipment(page: Page) {
    await openAs(page, "/equipment", "Lebo Maseko");
    await page.getByRole("button", { name: "Add equipment" }).click();
  }

  test("uses VESPER's own dropdown and date controls, never the browser's", async ({ page }) => {
    await openAddEquipment(page);
    await expect(dialog(page).getByLabel("Category")).toBeVisible();
    // Native selects stay behind the scenes, invisible and out of the tab order.
    expect(await page.locator("select:not([aria-hidden='true'])").count()).toBe(0);
    expect(await page.locator("input[type='date'], input[type='time'], input[type='datetime-local']").count()).toBe(0);
  });

  test("adds a search box to long lists and not to short ones", async ({ page }) => {
    await openAddEquipment(page);
    await dialog(page).getByLabel("Category").click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(page.getByLabel("Search the list")).toBeVisible();
    await page.getByLabel("Search the list").fill("pum");
    await expect(page.getByRole("option")).toHaveCount(1);
    await page.getByLabel("Search the list").fill("zzz");
    await expect(page.getByText(/Nothing matches/)).toBeVisible();
    await page.getByLabel("Search the list").fill("");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    // Escape closed only the dropdown. The dialog is still open.
    await expect(dialog(page)).toBeVisible();

    await dialog(page).getByLabel("Operating area").click();
    await expect(page.getByLabel("Search the list")).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test("chooses with the keyboard alone", async ({ page }) => {
    await openAddEquipment(page);
    await dialog(page).getByLabel("Category").focus();
    await page.keyboard.press("ArrowDown");
    await page.getByLabel("Search the list").fill("dozer");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(dialog(page).getByLabel("Category")).toContainText("Dozer");
  });

  test("picks a date from the calendar and accepts typed dates", async ({ page }) => {
    await openAs(page, "/equipment/eq-crusher-c02/service/new", "Lebo Maseko");
    const field = page.getByLabel("Preferred date");
    await field.locator("xpath=ancestor::span[contains(@class,'date-field')]").getByRole("button", { name: "Open calendar" }).click();
    await expect(page.getByRole("dialog", { name: "Choose a date" })).toBeVisible();
    await expect(page.getByText("April 2025")).toBeVisible();
    await page.getByRole("button", { name: "Next month" }).click();
    await page.getByRole("button", { name: "6 May 2025", exact: true }).click();
    await expect(field).toHaveValue("2025-05-06");

    await field.fill("25/12/2025");
    await field.blur();
    await expect(field).toHaveValue("2025-12-25");

    await field.locator("xpath=ancestor::span[contains(@class,'date-field')]").getByRole("button", { name: "Open calendar" }).click();
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(field).toHaveValue("");
  });

  test("moves around the calendar with the keyboard", async ({ page }) => {
    await openAs(page, "/equipment/eq-crusher-c02/service/new", "Lebo Maseko");
    const field = page.getByLabel("Preferred date");
    await field.fill("2025-05-06");
    await field.press("Alt+ArrowDown");
    await expect(page.getByRole("button", { name: "6 May 2025", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(field).toHaveValue("2025-05-14");
  });

  test("picks times from a list and tidies typed times", async ({ page }) => {
    await openAs(page, "/shifts", "Amina Patel");
    await page.getByRole("button", { name: "Create shift" }).click();
    const start = dialog(page).getByLabel("Starts");
    await start.fill("6.30");
    await start.blur();
    await expect(start).toHaveValue("06:30");
    await start.locator("xpath=ancestor::span[contains(@class,'date-field')]").getByRole("button", { name: "Open times" }).click();
    await page.getByRole("option", { name: "07:15" }).click();
    await expect(start).toHaveValue("07:15");
  });

  test("combines a date and a time into one deadline", async ({ page }) => {
    await openAs(page, "/exceptions/issue-riv-001", "John Dlamini");
    await page.getByRole("button", { name: /Add action/ }).first().click();
    await dialog(page).getByLabel(/Deadline/).fill("2025-04-24");
    await dialog(page).getByLabel("Time (24-hour)").fill("16:00");
    await expect(dialog(page).getByLabel(/Deadline/)).toHaveValue("2025-04-24");
    await expect(dialog(page).getByLabel("Time (24-hour)")).toHaveValue("16:00");
    await dialog(page).getByRole("button", { name: "Open calendar" }).click();
    await expect(page.getByRole("button", { name: "24 April 2025", exact: true })).toBeVisible();
  });

  test("lets a dropdown inside a dialog open above the dialog edge without being cut off", async ({ page }) => {
    await openAddEquipment(page);
    await dialog(page).getByLabel("Category").click();
    const box = await page.getByRole("listbox").boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThan(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    await pick(dialog(page).getByLabel("Category"), "Excavator").catch(() => undefined);
  });
});
