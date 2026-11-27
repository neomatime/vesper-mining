/**
 * Browser test (Playwright, a Pixel 7 phone). VESPER Mobile on its own: signing in lands on My Shift, the four tabs, My Work with
 * task completion, an offline report kept as Pending Synchronisation, the shift calendar, and issue and shift pages inside the app.
 */
import { expect, test } from "@playwright/test";
import { openAs, signIn } from "./support";

test("signs in to My Shift, whatever the role, with the four field tabs", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fmy-shift$/);
  await signIn(page, "Thabo Molefe");
  await expect(page).toHaveURL(/\/my-shift$/);
  await expect(page.getByRole("heading", { name: /Good morning, Thabo/ })).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Field navigation" });
  for (const name of ["My Shift", "My Work", "Report", "Notifications"]) await expect(tabs.getByRole("link", { name })).toBeVisible();
  await page.getByRole("button", { name: /Account menu for Thabo Molefe/ }).click();
  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  // An office role signing in to VESPER Mobile also lands on My Shift, not on a Mining Operations page.
  await signIn(page, "Naledi Khoza");
  await expect(page).toHaveURL(/\/my-shift$/);
});

test("shows a field employee their own shift and tasks, and lets them reopen a task", async ({ page }) => {
  await openAs(page, "/my-shift");
  await expect(page.getByText(/Shift A · 06:00–14:00/)).toBeVisible();
  await expect(page.getByText(/Operator · EX-204/)).toBeVisible();
  await expect(page.getByText(/remaining/)).toBeVisible();
  await page.getByRole("navigation", { name: "Field navigation" }).getByRole("link", { name: "My Work" }).click();
  await expect(page).toHaveURL(/\/my-work$/);
  await expect(page.getByText("North Pit pre-start observation")).toBeVisible();
  await page.getByRole("button", { name: /Reopen: North Pit pre-start observation/ }).click();
  await expect(page.getByRole("button", { name: /Mark done: North Pit pre-start observation/ })).toBeVisible();
});

test("keeps a report made offline as Pending Synchronisation", async ({ page }) => {
  await openAs(page, "/report");
  await page.getByRole("button", { name: "Work offline" }).click();
  await page.getByLabel("Issue title").fill("Hydraulic leak observed");
  await page.getByLabel("Observed condition").fill("A small hydraulic leak was observed during the pre-start inspection.");
  await page.getByRole("button", { name: "Save pending report" }).click();
  await expect(page.getByText("Pending Synchronisation")).toBeVisible();
  await expect(page.getByText(/has not been received centrally/)).toBeVisible();
  await page.getByRole("link", { name: "Return to My Shift" }).click();
  await expect(page).toHaveURL(/\/my-shift$/);
});

test("reports an issue online and follows it on its own page in the app", async ({ page }) => {
  await openAs(page, "/report");
  await page.getByLabel("Issue title").fill("Loose guard on conveyor CV-3");
  await page.getByLabel("Observed condition").fill("The tail pulley guard on CV-3 is loose on the left side.");
  await page.getByRole("button", { name: "Record issue" }).click();
  await expect(page).toHaveURL(/\/issues\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Loose guard on conveyor CV-3" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latest updates" })).toBeVisible();
});

test("opens the shift calendar from My Shift, and a shift on its own page", async ({ page }) => {
  await openAs(page, "/my-shift", "Amina Patel");
  await page.getByRole("link", { name: /Shift calendar/ }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByRole("heading", { name: "Thursday 24 April 2025" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Shift B/ })).toHaveCount(0);
  await page.getByRole("button", { name: "All shifts" }).click();
  await expect(page.getByRole("link", { name: /Shift B/ })).toBeVisible();
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.getByRole("heading", { name: "May 2025", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Today" }).click();

  await page.getByRole("link", { name: /Shift A/ }).first().click();
  await expect(page).toHaveURL(/\/shifts\/shift-a-20250424$/);
  await expect(page.getByRole("heading", { name: /^Crew/ })).toBeVisible();
  await expect(page.locator("main").getByText("Amina Patel").first()).toBeVisible();
});

test("offers month, week and day in the calendar, with touch-sized controls", async ({ page }) => {
  await openAs(page, "/schedule", "Amina Patel");
  for (const name of ["Previous month", "Next month"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await expect(page.getByRole("heading", { name: "21 April – 27 April 2025", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Friday 25 April 2025.*no shifts/ }).click();
  await expect(page.getByText("You are not on a shift this day.")).toBeVisible();
});

test("no page scrolls sideways", async ({ page }) => {
  await openAs(page, "/my-shift");
  for (const route of ["/my-shift", "/my-work", "/report", "/notifications", "/profile", "/schedule", "/shifts/shift-a-20250424"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${route} scrolls sideways`).toBeLessThanOrEqual(0);
  }
});
