/**
 * Browser test (Playwright, a Pixel 7 phone). VESPER Mobile on its own: signing in lands on My Shift, the four tabs, My Work with
 * task completion, the outbox for offline reports, photos and location on a report, My reports, the equipment pre-start check,
 * the shift calendar, and issue and shift pages inside the app.
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
  // The field app keeps to field work: no links out to the web app or to administration.
  await expect(page.getByRole("group", { name: "Account menu" })).toBeVisible();
  await expect(page.getByRole("link", { name: /on the web|Administration/ })).toHaveCount(0);
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

test("keeps a report made offline in the outbox, then sends it on reconnecting", async ({ page }) => {
  await openAs(page, "/report");
  await page.getByRole("button", { name: "Work offline" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Offline" })).toBeVisible();
  await page.getByLabel("Issue title").fill("Hydraulic leak observed");
  await page.getByLabel("Observed condition").fill("A small hydraulic leak was observed during the pre-start inspection.");
  await page.getByRole("button", { name: "Save pending report" }).click();
  await expect(page.getByText("Pending Synchronisation")).toBeVisible();
  await expect(page.getByText(/has not been received centrally/)).toBeVisible();

  // It waits on the phone, survives a reload, and is not received centrally until the phone is back online.
  await page.getByRole("link", { name: "See My reports" }).click();
  await expect(page).toHaveURL(/\/my-reports$/);
  const outbox = page.getByRole("region", { name: /Waiting to send/ });
  await expect(outbox).toContainText("Hydraulic leak observed");
  await page.reload();
  await expect(page.getByRole("region", { name: /Waiting to send \(1\)/ })).toBeVisible();
  await expect(page.getByRole("region", { name: /^Open/ })).not.toContainText("Hydraulic leak observed");
  await page.getByRole("button", { name: "Back online and send" }).click();
  await expect(page.getByRole("region", { name: /Waiting to send/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: /^Open/ }).getByRole("link", { name: /Hydraulic leak observed/ })).toBeVisible();
});

test("adds photos and the phone's location to a report, and shows them on the issue", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -24.6612, longitude: 30.0601, accuracy: 9 });
  await openAs(page, "/report");
  await page.getByLabel("Issue title").fill("Cracked step on EX-204");
  await page.getByLabel("Observed condition").fill("The lower access step on the left side is cracked through.");
  // A tiny PNG stands in for a camera photo.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64");
  await page.getByLabel("Take or add photos").setInputFiles({ name: "step.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("img", { name: "Photo 1 of the issue" })).toBeVisible();
  await page.getByRole("button", { name: "Add my location" }).click();
  await expect(page.getByText("-24.66120, 30.06010")).toBeVisible();
  await page.getByRole("button", { name: "Record issue" }).click();
  await expect(page).toHaveURL(/\/issues\/[^/]+$/);
  await expect(page.getByRole("img", { name: "Photo 1 with the report" })).toBeVisible();
  await expect(page.getByText(/Reporter's location, accurate to about 9 m/)).toBeVisible();

  await page.getByRole("link", { name: "My reports" }).click();
  const card = page.getByRole("link", { name: /Cracked step on EX-204/ });
  await expect(card).toContainText("Received, waiting for review");
  await expect(card).toContainText("1 photo");
});

test("does the pre-start check for my machine, raising a failed item as a fault", async ({ page }) => {
  await openAs(page, "/my-shift");
  await page.getByRole("link", { name: /Pre-start check for EX-204/ }).click();
  await expect(page).toHaveURL(/\/checks\/eq-ex204$/);
  await expect(page.getByRole("heading", { name: "Hydraulic Excavator EX-204" })).toBeVisible();

  // Nothing answered yet: it says so.
  await page.getByRole("button", { name: "Record check" }).click();
  await expect(page.getByText(/Answer every item/)).toBeVisible();

  const groups = page.getByRole("radiogroup");
  const count = await groups.count();
  for (let index = 0; index < count; index += 1) await groups.nth(index).getByRole("radio", { name: "Pass" }).click();
  await page.getByRole("radiogroup", { name: "Hoses and fittings" }).getByRole("radio", { name: "Fail" }).click();
  await page.getByLabel("What is wrong with Hoses and fittings").fill("Hose weeping at the boom foot");
  await page.getByText("Only with a restriction").click();
  await page.getByRole("button", { name: "Record check" }).click();
  await expect(page.getByRole("heading", { name: "1 fault reported" })).toBeVisible();

  await page.getByRole("link", { name: "Track the faults" }).click();
  await expect(page.getByRole("link", { name: /Hydraulic Excavator EX-204: Hoses and fittings failed pre-start/ })).toBeVisible();
  await page.getByRole("navigation", { name: "Field navigation" }).getByRole("link", { name: "My Shift" }).click();
  await expect(page.getByRole("link", { name: /1 fault reported on EX-204/ })).toBeVisible();
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
  for (const route of ["/my-shift", "/my-work", "/report", "/my-reports", "/checks/eq-ex204", "/scan", "/machines/eq-ex204", "/notifications", "/profile", "/schedule", "/shifts/shift-a-20250424"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${route} scrolls sideways`).toBeLessThanOrEqual(0);
  }
});

test("opens a machine by its fleet number, with its checks and open issues, and reports a fault on it", async ({ page }) => {
  await openAs(page, "/my-shift");
  await page.getByRole("link", { name: /Scan a machine/ }).click();
  await expect(page).toHaveURL(/\/scan$/);
  // The test browser has no camera: the page says so and offers the fleet number instead.
  await expect(page.getByRole("status").filter({ hasText: /QR codes|camera/ })).toBeVisible();
  await page.getByLabel("Fleet number").fill("ex 999");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByText(/No machine matches/)).toBeVisible();
  await page.getByLabel("Fleet number").fill("ex204");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/machines\/eq-ex204$/);
  await expect(page.getByRole("heading", { name: "Hydraulic Excavator EX-204" })).toBeVisible();
  await expect(page.getByText("Not done this shift")).toBeVisible();

  await page.getByRole("link", { name: /Report a fault/ }).click();
  await expect(page).toHaveURL(/\/report\?equipmentId=eq-ex204$/);
  await expect(page.getByRole("combobox", { name: /^Equipment/ })).toContainText("Hydraulic Excavator EX-204");
});

test("confirms the briefing and the handover from the shift before", async ({ page }) => {
  await openAs(page, "/my-shift");
  const before = page.getByRole("region", { name: "Before you start" });
  await expect(before).toContainText("Watch the North Pit haul road");
  await expect(before).toContainText("Handover from Shift C");
  await before.getByRole("button", { name: "I've read it" }).first().click();
  await expect(before.getByText(/You confirmed at/)).toHaveCount(1);
  await before.getByRole("button", { name: "I've read it" }).click();
  await expect(before.getByText(/You confirmed at/)).toHaveCount(2);
  await expect(before.getByRole("button", { name: "I've read it" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "Before you start" }).getByText(/You confirmed at/)).toHaveCount(2);
});
