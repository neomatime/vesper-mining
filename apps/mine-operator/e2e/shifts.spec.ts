import { expect, test, type Page } from "@playwright/test";
import { actAs, openAs } from "./support";

test.describe("shift management", () => {
  test.skip(({ isMobile }) => isMobile, "Shift management is exercised on the desktop layout.");

  const dialog = (page: Page) => page.getByRole("dialog");

  async function createShift(page: Page, supervisor = "Sipho Nkosi", briefing = true) {
    await page.getByRole("button", { name: "Create shift" }).click();
    await expect(dialog(page).getByLabel("Shift name")).toHaveValue("Shift C");
    await expect(dialog(page).getByLabel("Date")).toHaveValue("2025-04-24");
    await dialog(page).getByLabel("Supervisor").selectOption(supervisor);
    if (briefing) await dialog(page).getByLabel(/Briefing/).fill("Heavy rain is forecast after midnight.");
    await dialog(page).getByRole("button", { name: "Create shift" }).click();
  }

  test("creates a shift with the next slot suggested, then plans its crew and work", async ({ page }) => {
    await openAs(page, "/shifts", "Amina Patel");
    await createShift(page);
    await expect(page.getByRole("heading", { name: "Shift C" })).toBeVisible();
    await expect(page.getByText("Supervised by Sipho Nkosi")).toBeVisible();
    await expect(page.getByText("Heavy rain is forecast after midnight.")).toBeVisible();

    await page.getByRole("button", { name: "Add crew" }).click();
    await dialog(page).getByLabel("Person").selectOption("Thabo Molefe");
    await dialog(page).getByLabel("Duty").fill("Drill operator");
    await dialog(page).getByLabel("Equipment (optional)").selectOption({ label: "Track Dozer DZ-017" });
    await dialog(page).getByRole("button", { name: "Add to shift" }).click();
    await expect(page.getByText("Drill operator · Track Dozer DZ-017")).toBeVisible();

    await page.getByRole("button", { name: "Add work" }).click();
    await dialog(page).getByLabel(/Attach an open issue/).selectOption({ index: 1 });
    await expect(dialog(page).getByLabel("What needs doing")).toHaveValue(/Follow up:/);
    await dialog(page).getByRole("button", { name: "Add work" }).click();
    await expect(page.getByText("Follow up: Crusher C-02 — Feed Interruption", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Mark done: Follow up/ }).click();
    await expect(page.getByText(/1 of 1 finished/)).toBeVisible();

    await page.getByRole("button", { name: "Remove Thabo Molefe from the shift" }).click();
    await expect(page.getByText("Drill operator · Track Dozer DZ-017")).toHaveCount(0);
  });

  test("will not schedule a shift that overlaps another on the same site", async ({ page }) => {
    await openAs(page, "/shifts", "Amina Patel");
    await page.getByRole("button", { name: "Create shift" }).click();
    await dialog(page).getByLabel("Shift name").fill("Shift X");
    await dialog(page).getByLabel("Starts").fill("12:00");
    await dialog(page).getByLabel("Ends").fill("20:00");
    await dialog(page).getByRole("button", { name: "Create shift" }).click();
    await expect(page.getByText(/overlaps Shift/)).toBeVisible();
  });

  test("edits a scheduled shift and records the change", async ({ page }) => {
    await openAs(page, "/shifts/shift-b-20250424", "Amina Patel");
    await page.getByRole("button", { name: "Edit", exact: true }).first().click();
    await dialog(page).getByLabel("Shift name").fill("Afternoon shift");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: "Afternoon shift" })).toBeVisible();
    await expect(page.getByText(/Updated name/)).toBeVisible();
  });

  test("cancels a scheduled shift with a reason and keeps it read-only", async ({ page }) => {
    await openAs(page, "/shifts/shift-b-20250424", "Amina Patel");
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: /Cancel shift/ }).click();
    await dialog(page).getByLabel("Why is it being cancelled").fill("Public holiday, no production.");
    await dialog(page).getByRole("button", { name: "Cancel shift" }).click();
    await expect(page.getByText(/Cancelled\. This shift is read-only/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add crew" })).toHaveCount(0);
  });

  test("deletes an empty shift made in error", async ({ page }) => {
    await openAs(page, "/shifts", "Amina Patel");
    await createShift(page, "Sipho Nkosi", false);
    await expect(page.getByRole("heading", { name: "Shift C" })).toBeVisible();
    const created = new URL(page.url()).pathname;
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: /Delete/ }).click();
    await dialog(page).getByRole("button", { name: "Delete shift" }).click();
    await expect(page).toHaveURL(/\/shifts$/);
    await expect(page.locator(`a[href="${created}"]`)).toHaveCount(0);
  });

  test("runs a shift end to end: hand over, close, then the next supervisor starts", async ({ page }) => {
    await openAs(page, "/shifts/shift-a-20250424", "Amina Patel");
    await page.getByRole("button", { name: "Close shift" }).click();
    await dialog(page).getByRole("button", { name: "Close shift" }).click();
    await expect(page.getByText(/Publish the handover before closing/)).toBeVisible();

    await page.goto("/shifts/shift-a-20250424/handover");
    await page.getByRole("button", { name: "Publish handover" }).click();
    await expect(page.getByText("Handover published")).toBeVisible();

    await page.goto("/shifts/shift-a-20250424");
    await page.getByRole("button", { name: "Close shift" }).click();
    await dialog(page).getByRole("button", { name: "Close shift" }).click();
    await expect(page.getByText(/Shift A closed/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add crew" })).toHaveCount(0);

    await actAs(page, "Sipho Nkosi");
    await page.goto("/shifts/shift-a-20250424/handover");
    await page.getByRole("button", { name: "Acknowledge handover" }).click();
    await expect(page.getByText(/Acknowledged by Sipho Nkosi/)).toBeVisible();

    await page.goto("/shifts/shift-b-20250424");
    await page.getByRole("button", { name: "Start shift" }).click();
    await expect(page.getByText("Shift B started")).toBeVisible();
  });

  test("only lets the next shift's supervisor or the Mine Manager acknowledge", async ({ page }) => {
    await openAs(page, "/shifts/shift-a-20250424/handover", "Amina Patel");
    await page.getByRole("button", { name: "Publish handover" }).click();
    await expect(page.getByText("Handover published")).toBeVisible();
    await expect(page.getByRole("button", { name: "Acknowledge handover" })).toBeDisabled();
    await expect(page.getByText(/not the person who published it/)).toBeVisible();
  });

  test("keeps shift management to management roles", async ({ page }) => {
    await openAs(page, "/shifts", "Lebo Maseko");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create shift" })).toHaveCount(0);
    await page.goto("/shifts/shift-b-20250424");
    await expect(page.getByRole("button", { name: "Add crew" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start shift" })).toHaveCount(0);
  });

  test("shows a field employee their own shift and tasks on the phone layout", async ({ page }) => {
    await openAs(page, "/mobile/my-shift", "Thabo Molefe");
    await expect(page.getByText(/Shift A · 06:00–14:00/)).toBeVisible();
    await expect(page.getByText(/Operator · EX-204/)).toBeVisible();
    await expect(page.getByText(/remaining/)).toBeVisible();
    await page.goto("/mobile/my-work");
    await expect(page.getByText("North Pit pre-start observation")).toBeVisible();
    await page.getByRole("button", { name: /Reopen: North Pit pre-start observation/ }).click();
    await expect(page.getByRole("button", { name: /Mark done: North Pit pre-start observation/ })).toBeVisible();
  });

  test("shows the current shift on the command centre and in search", async ({ page }) => {
    await openAs(page, "/overview", "John Dlamini");
    await expect(page.getByText(/Shift A · 06:00–14:00/)).toBeVisible();
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: /Search records/ }).fill("shift b");
    await expect(page.getByRole("option", { name: /Shift B/ })).toBeVisible();
  });
});
