import { expect, test } from "@playwright/test";
import { openAs } from "./support";

test.describe("shift calendar on the web", () => {
  test.skip(({ isMobile }) => isMobile, "The wide calendar is exercised on the desktop layout.");

  test("shows shifts on the days they start and moves between months, weeks and today", async ({ page }) => {
    await openAs(page, "/shifts", "John Dlamini");
    await page.getByRole("link", { name: "Calendar" }).click();
    await expect(page).toHaveURL(/view=calendar/);
    await expect(page.getByRole("heading", { name: "April 2025", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /06:00 Shift A/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /14:00 Shift B/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Thursday 24 April 2025" })).toBeVisible();
    await expect(page.getByText("2 shifts", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Next month" }).click();
    await expect(page.getByRole("heading", { name: "May 2025", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Today" }).click();
    await expect(page.getByRole("heading", { name: "April 2025", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Week", exact: true }).click();
    await expect(page.getByRole("heading", { name: "21 April – 27 April 2025", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next week" }).click();
    await expect(page.getByRole("heading", { name: "28 April – 4 May 2025", exact: true })).toBeVisible();
  });

  test("opens a shift from the calendar and creates one on a chosen day", async ({ page }) => {
    await openAs(page, "/shifts?view=calendar", "John Dlamini");
    await page.getByRole("button", { name: /Friday 25 April 2025.*no shifts/ }).first().click();
    await expect(page.getByRole("heading", { name: "Friday 25 April 2025" })).toBeVisible();
    await expect(page.getByText("Nothing planned")).toBeVisible();
    await page.getByRole("button", { name: "Create shift on this day" }).click();
    await expect(page.getByRole("dialog").getByLabel("Date")).toHaveValue("2025-04-25");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("link", { name: /06:00 Shift A/ }).click();
    await expect(page).toHaveURL(/\/shifts\/[^?]+$/);
    await expect(page.getByRole("heading", { name: "Shift A" })).toBeVisible();
  });

  test("keeps the list view one click away", async ({ page }) => {
    await openAs(page, "/shifts?view=calendar", "Amina Patel");
    await page.getByRole("link", { name: "List" }).click();
    await expect(page.getByRole("columnheader", { name: "Supervisor" })).toBeVisible();
  });
});

test.describe("shift calendar on mobile", () => {
  test("opens from My Shift, shows my shifts for the day and can show every shift", async ({ page }) => {
    await openAs(page, "/mobile/my-shift", "Amina Patel");
    await page.getByRole("link", { name: /Shift calendar/ }).click();
    await expect(page).toHaveURL(/\/mobile\/schedule$/);
    await expect(page.getByRole("heading", { name: "Shift calendar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Thursday 24 April 2025" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Shift A/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Shift B/ })).toHaveCount(0);

    await page.getByRole("button", { name: "All shifts" }).click();
    await expect(page.getByRole("link", { name: /Shift B/ })).toBeVisible();

    await page.getByRole("button", { name: "Next month" }).click();
    await expect(page.getByRole("heading", { name: "May 2025", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Today" }).click();
    await expect(page.getByRole("heading", { name: "April 2025", exact: true })).toBeVisible();
  });
});
