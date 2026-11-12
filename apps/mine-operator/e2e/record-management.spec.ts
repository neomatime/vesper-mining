import { expect, test, type Page } from "@playwright/test";
import { actAs, openAs } from "./support";

test.describe("record management", () => {
  test.skip(({ isMobile }) => isMobile, "Record management is exercised on the desktop layout.");

  const openApp = (page: Page, path: string) => openAs(page, path);

  const dialog = (page: Page) => page.getByRole("dialog");

  async function step(page: Page, label: string, note?: string) {
    await page.getByRole("button", { name: label, exact: true }).click();
    if (note) await dialog(page).getByRole("textbox").fill(note);
    await dialog(page).getByRole("button", { name: label, exact: true }).click();
    await expect(dialog(page)).toBeHidden();
  }

  test("takes an issue from report to close with the right people at each step", async ({ page }) => {
    await openApp(page, "/exceptions/new");
    await page.getByLabel("Issue title").fill("Hydraulic hose leak on EX-204");
    await page.getByLabel("Observed condition").fill("A hose leak was seen at the boom cylinder during the pre-start check.");
    await page.getByRole("button", { name: "Record issue" }).click();
    await expect(page.getByRole("heading", { name: "Hydraulic hose leak on EX-204" })).toBeVisible();

    await step(page, "Mark reviewed");
    await expect(page.getByText("Reported → Reviewed")).toBeVisible();

    // Assignment is blocked until there is an owner and an action with a deadline.
    await expect(page.getByRole("button", { name: "Confirm assignment" })).toBeDisabled();
    await expect(page.getByText("Select an accountable owner first.")).toBeVisible();

    await page.getByRole("button", { name: "Edit details" }).click();
    await dialog(page).getByLabel(/Accountable owner/).selectOption("Lebo Maseko");
    await dialog(page).getByLabel("Priority").selectOption("high");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByText("Accountable owner set to Lebo Maseko")).toBeVisible();

    await page.getByRole("button", { name: "Add action" }).click();
    await dialog(page).getByLabel("What needs to happen").fill("Replace the hose and pressure test");
    await dialog(page).getByLabel("Owner").selectOption("Lebo Maseko");
    await dialog(page).getByLabel("Team").selectOption("Maintenance");
    await dialog(page).getByLabel(/Deadline/).fill("2025-04-24T16:00");
    await dialog(page).getByRole("button", { name: "Add action" }).click();
    await expect(page.getByText("Replace the hose and pressure test").first()).toBeVisible();

    await step(page, "Confirm assignment");
    await expect(page.getByText("Reviewed → Action assigned")).toBeVisible();

    await actAs(page, "Lebo Maseko");
    await step(page, "Start work");
    await step(page, "Report resolution", "Replaced the hose and tested to working pressure.");
    await expect(page.getByText("Resolution reported", { exact: true }).first()).toBeVisible();

    // A planner cannot verify. Independence of the verifier is covered by the domain tests.
    await expect(page.getByRole("button", { name: "Verify resolution" })).toBeDisabled();
    await expect(page.getByText(/Verification is done by a Shift Supervisor or Mine Manager/).first()).toBeVisible();

    await actAs(page, "Amina Patel");
    await step(page, "Verify resolution", "Inspected the new hose and the pressure test record.");
    await expect(page.getByText("Independent verification", { exact: true })).toBeVisible();

    // Verification does not close the issue while an action is still open.
    await expect(page.getByRole("button", { name: "Close issue" })).toBeDisabled();
    await expect(page.getByText("Complete or remove the remaining actions before closing.")).toBeVisible();
  });

  test("cancelled issues become read-only history with their reason kept", async ({ page }) => {
    await openApp(page, "/exceptions/new");
    await page.getByLabel("Issue title").fill("Conveyor belt mistracking");
    await page.getByLabel("Observed condition").fill("The feed conveyor belt is mistracking to the left side.");
    await page.getByRole("button", { name: "Record issue" }).click();
    await expect(page.getByRole("heading", { name: "Conveyor belt mistracking" })).toBeVisible();

    await step(page, "Cancel issue", "Raised in error, the belt was already realigned.");
    await expect(page.getByText(/Cancelled\. This record is read-only history/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit details" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add action" })).toHaveCount(0);
    await expect(page.getByText("Raised in error, the belt was already realigned.")).toBeVisible();
  });

  test("resolves a dependency, resumes work and keeps the history", async ({ page }) => {
    await openApp(page, "/exceptions/issue-riv-001");
    await expect(page.getByRole("button", { name: "Resume work" })).toBeDisabled();
    await page.getByRole("button", { name: "Resolve", exact: true }).click();
    await dialog(page).getByRole("textbox").fill("Stores confirmed the filter kit is on the shelf.");
    await dialog(page).getByRole("button", { name: "Mark resolved" }).click();
    await expect(page.getByText(/Resolved: Stores confirmed/)).toBeVisible();

    await step(page, "Resume work");
    await expect(page.getByText("Awaiting dependency → In progress")).toBeVisible();
  });

  test("removes an action and brings it back with undo", async ({ page }) => {
    await openApp(page, "/exceptions/issue-riv-001");
    await page.getByRole("button", { name: /Remove action: Mobilise repair team/ }).click();
    await expect(page.getByText("Action removed", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Remove action: Mobilise repair team/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Action restored", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Remove action: Mobilise repair team/ })).toBeVisible();
  });

  test("keeps records and the chosen persona after a refresh", async ({ page }) => {
    await openApp(page, "/exceptions/new");
    await page.getByLabel("Issue title").fill("Water pump pressure drop");
    await page.getByLabel("Observed condition").fill("The dewatering pump pressure dropped during the morning shift.");
    await page.getByRole("button", { name: "Record issue" }).click();
    await expect(page.getByRole("heading", { name: "Water pump pressure drop" })).toBeVisible();
    await actAs(page, "Amina Patel");
    await page.goto("/exceptions");
    await expect(page.getByRole("button", { name: /Account menu for Amina Patel/ })).toBeVisible();
    await expect(page.getByText("Water pump pressure drop")).toBeVisible();
  });

  test("filters the issue register and explains an empty result", async ({ page }) => {
    await openApp(page, "/exceptions");
    await expect(page.getByText("Crusher C-02 — Feed Interruption")).toBeVisible();
    await page.getByRole("button", { name: "Awaiting dependency" }).click();
    await expect(page.getByText("Central Pit — Reduced Output")).toBeHidden();
    await page.getByRole("button", { name: "Finished" }).click();
    await expect(page.getByText("No records match these filters")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText("Central Pit — Reduced Output")).toBeVisible();
  });

  test("records stock figures as reported, and only Stores can verify them", async ({ page }) => {
    await openApp(page, "/resources/readiness-ex204-1000h");
    await expect(page.getByRole("heading", { name: /EX-204/ }).first()).toBeVisible();
    await page.getByRole("button", { name: /Update stock for Hydraulic/ }).click();
    await expect(dialog(page).getByLabel(/Mark as verified/)).toBeDisabled();
    await dialog(page).getByLabel("On hand").fill("3");
    await dialog(page).getByLabel("Reserved").fill("0");
    await dialog(page).getByLabel(/Where do these figures come from/).fill("Counted in the stores bay this morning");
    await dialog(page).getByRole("button", { name: "Save figures" }).click();
    await expect(page.getByText("Stock figures saved")).toBeVisible();
    await expect(page.getByText("Reported", { exact: true }).first()).toBeVisible();

    await actAs(page, "Naledi Khoza");
    await page.getByRole("button", { name: /Update stock for OEM engine oil/ }).click();
    await dialog(page).getByLabel("On hand").fill("2");
    await dialog(page).getByLabel("Reserved").fill("0");
    await dialog(page).getByLabel(/Where do these figures come from/).fill("Physical count signed off by stores");
    await dialog(page).getByLabel(/Mark as verified/).check();
    await dialog(page).getByRole("button", { name: "Save figures" }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByText("Verified", { exact: true }).first()).toBeVisible();
  });

  test("records a readiness review without ordering anything", async ({ page }) => {
    await openApp(page, "/resources/readiness-ex204-1000h");
    await page.getByRole("button", { name: "Record review" }).click();
    await dialog(page).getByRole("textbox").fill("Filter kit lead time puts the service date at risk.");
    await dialog(page).getByRole("button", { name: "Record review" }).click();
    await expect(page.getByText("No purchase was approved or submitted.")).toBeVisible();
    await expect(page.getByText("Latest review")).toBeVisible();
  });

  test("publishes and acknowledges a handover with two different people", async ({ page }) => {
    await openApp(page, "/shifts/shift-a-20250424/handover");
    await actAs(page, "Amina Patel");
    await page.getByRole("button", { name: "Publish handover" }).click();
    await expect(page.getByText("Handover published")).toBeVisible();
    await expect(page.getByRole("button", { name: "Acknowledge handover" })).toBeDisabled();
    await expect(page.getByText(/not the person who published it/)).toBeVisible();

    await actAs(page, "John Dlamini");
    await page.getByRole("button", { name: "Acknowledge handover" }).click();
    await expect(page.getByText(/Acknowledged by John Dlamini/)).toBeVisible();
    // Acknowledging receipt leaves the underlying issues open.
    await expect(page.getByText("Crusher C-02 — Feed Interruption")).toBeVisible();
  });

  test("marks notifications read, dismisses one and can undo", async ({ page }) => {
    await openApp(page, "/overview");
    await page.getByRole("button", { name: /Notifications, \d+ unread/ }).click();
    await page.getByRole("button", { name: "Mark all read" }).click();
    await expect(page.getByRole("button", { name: "Notifications, 0 unread" })).toBeVisible();
    await page.getByRole("button", { name: /Dismiss: Shift handover preparation/ }).click();
    await expect(page.getByText("Notification dismissed")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await page.getByRole("button", { name: /Notifications/ }).click();
    await expect(page.getByRole("link", { name: /Shift handover preparation/ })).toBeVisible();
  });
});
