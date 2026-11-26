/**
 * Browser test (Playwright, desktop Chrome and a phone). The Gold demonstration: "What happens if we wait?" on the equipment issue,
 * the three required scenarios, the same figures on every connected page, repair completion that keeps the actual downtime, missing
 * inputs, the history of changes, and who sees money. Runs against a production build; see playwright.config.ts.
 */
import { expect, test, type Page } from "@playwright/test";
import { actAs, openAs } from "./support";

const issue = "/exceptions/issue-gold-001";
const section = (page: Page) => page.getByRole("region", { name: "What happens if we wait?" });
const choose = async (page: Page, hours: number) => {
  await section(page).getByRole("button", { name: `${hours} hour outage` }).click();
  await expect(page.getByText("Scenario changed", { exact: true })).toBeVisible();
};

test.describe("what happens if we wait", () => {
  test("leads with the consequence, then the facts, then the actions, on the equipment issue", async ({ page }) => {
    await openAs(page, issue, "John Dlamini");
    const wait = section(page);
    await expect(wait).toContainText("Gold delivery · forecast");
    await expect(wait.getByRole("status")).toContainText("Up to 180 g of the 1,000 g gold delivery to Highveld Refiners");
    await expect(wait.getByRole("status")).toContainText("Estimated sales value potentially delayed: R 180,000");
    for (const text of ["Delivery deadline", "25 Apr · 08:00", "Stock keeps processing running for", "3 hours", "Expected repair completion", "24 Apr · 10:00", "Original target", "1,000 g", "Current forecast", "820 g", "Possible shortfall", "180 g", "Responsible", "Lebo Maseko", "Next action", "Replace the drive coupling", "Spare part", "Drive coupling DC-CR01", "Estimate last updated", "Safety and environment"]) {
      await expect(wait).toContainText(text);
    }
    await expect(wait).toContainText("A forecast, not verified production");
    await expect(wait.getByRole("link", { name: /View affected shipment/ })).toBeVisible();
    await expect(wait.getByRole("button", { name: "Update repair estimate" })).toBeVisible();
    await expect(wait.getByRole("link", { name: "Open repair task" })).toBeVisible();
  });

  test.describe("the three required outcomes", () => {
    for (const [hours, shortfall, gold, forecast, value] of [[2, "0 t", "0 g", "1,000 g", "R 0"], [4, "100 t", "180 g", "820 g", "R 180,000"], [6, "300 t", "540 g", "460 g", "R 540,000"]] as const) {
      test(`a ${hours} hour outage gives ${gold} affected, a ${forecast} forecast and ${value}`, async ({ page }) => {
        await openAs(page, issue, "John Dlamini");
        await choose(page, hours);
        const wait = section(page);
        await expect(wait.locator(".fact", { hasText: "Current forecast" })).toContainText(forecast);
        await expect(wait.locator(".fact", { hasText: "Possible shortfall" })).toContainText(gold);
        await expect(wait.locator(".fact", { hasText: "Estimated sales value potentially delayed" })).toContainText(value);
        await wait.getByText("How this was calculated").click();
        await expect(wait).toContainText(`Ore shortfall = ${shortfall}`);
        await expect(wait).toContainText(`Gold affected = ${gold}`);
        // The commitment never moves with the forecast.
        await expect(wait.locator(".fact", { hasText: "Original target" })).toContainText("1,000 g");
        await expect(wait.locator(".fact", { hasText: "Estimated sales value potentially delayed" })).toContainText("R 1,000,000 planned");
      });
    }
  });
});

test.describe("one change shows everywhere", () => {
  test("the Overview, equipment, shift, readiness and shipment pages follow the scenario", async ({ page }) => {
    await openAs(page, issue, "John Dlamini");
    await choose(page, 6);

    await page.goto("/overview");
    const attention = page.getByLabel("Also needs you");
    await expect(attention).toContainText("Crusher CR-01 — Motor Drive Failure");
    await expect(attention).toContainText("Up to 540 g");
    await expect(attention).toContainText("R 540,000");

    await page.goto("/equipment/eq-cr01");
    await expect(page.getByRole("article", { name: /Gold delivery: effect/ })).toContainText("Up to 540 g");

    await page.goto("/shifts/shift-a-20250424");
    const shift = page.getByRole("article", { name: /Gold delivery: effect/ });
    await expect(shift).toContainText("Effect on the production target");
    await expect(shift).toContainText("460 g");
    await expect(shift).toContainText("540 g");

    await page.goto("/shifts/production");
    await expect(page.getByRole("article", { name: /Gold delivery: effect/ })).toContainText("460 g");

    await page.goto("/resources/readiness-cr01-coupling");
    const readiness = page.getByRole("article", { name: /Gold delivery: effect/ });
    await expect(readiness).toContainText("Repair resources");
    await expect(readiness).toContainText("Drive coupling DC-CR01 · 1 needed");
    await expect(readiness).toContainText("Not confirmed at the mine");
    await expect(readiness).toContainText("Lebo Maseko");

    await page.goto("/shipments");
    await expect(page.getByRole("article", { name: "Gold delivery" })).toContainText("460 g");
    await page.goto("/shipments/gold");
    await expect(page.getByText("Original commitment")).toBeVisible();
    await expect(page.locator(".fact", { hasText: "Original commitment" })).toContainText("1,000 g");
    await expect(page.locator(".fact", { hasText: "Current forecast" })).toContainText("460 g");
    await expect(page.locator(".fact", { hasText: "Planned sales value" })).toContainText("R 1,000,000");
    await expect(page.locator(".fact", { hasText: "Linked production blocker" })).toContainText("CR-01");
    await expect(page.getByText(/does not verify gold/)).toBeVisible();
  });

  test("lets a person move between the issue, the plan and the shipment", async ({ page }) => {
    await openAs(page, issue, "John Dlamini");
    await section(page).getByRole("link", { name: /View affected shipment/ }).click();
    await expect(page).toHaveURL(/\/shipments\/gold$/);
    await page.getByRole("link", { name: "See what happens if we wait" }).click();
    await expect(page).toHaveURL(/\/exceptions\/issue-gold-001$/);
  });
});

test.describe("adjusting the inputs", () => {
  test("approved catch-up and usable stock change the forecast, and the reason goes in the history", async ({ page }) => {
    await openAs(page, issue, "John Dlamini");
    await section(page).getByRole("button", { name: "Adjust stock or catch-up" }).click();
    await page.getByLabel("Approved catch-up (tonnes)").fill("150");
    await page.getByLabel("Why are you changing it?").fill("A second processing shift was approved.");
    await page.getByRole("button", { name: "Save estimate" }).click();
    await expect(page.getByText("Estimate updated", { exact: true })).toBeVisible();
    await expect(section(page).locator(".fact", { hasText: "Current forecast" })).toContainText("1,000 g");
    await section(page).getByText(/History of the estimate/).click();
    await expect(section(page)).toContainText("A second processing shift was approved.");
    await expect(section(page)).toContainText("John Dlamini");
    await expect(section(page)).toContainText("820 g forecast");
  });

  test("says Impact not yet assessed when a required input is missing, and invents no figure", async ({ page }) => {
    await openAs(page, issue, "John Dlamini");
    await section(page).getByRole("button", { name: "Adjust stock or catch-up" }).click();
    await page.getByLabel("Usable stock downstream (tonnes)").fill("");
    await page.getByLabel("Why are you changing it?").fill("The stock count has not been done yet.");
    await page.getByRole("button", { name: "Save estimate" }).click();
    const wait = section(page);
    await expect(wait.getByRole("status")).toContainText("Impact not yet assessed");
    await expect(wait.locator(".fact", { hasText: "Current forecast" })).toContainText("Impact not yet assessed");
    await expect(wait.locator(".fact", { hasText: "Estimated sales value potentially delayed" })).toContainText("Impact not yet assessed");
    await page.goto("/shipments/gold");
    await expect(page.locator(".fact", { hasText: "Current forecast" })).toContainText("Impact not yet assessed");
  });
});

test.describe("recording the repair", () => {
  test("keeps the actual downtime and the shortfall it left, then recovers it only through recorded progress", async ({ page }) => {
    await openAs(page, issue, "John Dlamini");
    await section(page).getByRole("button", { name: "Record repair complete" }).click();
    await page.getByLabel(/Actual outage/).fill("6");
    await page.getByRole("button", { name: "Record repair complete" }).last().click();
    await expect(page.getByLabel("Messages").getByText("Repair recorded as complete", { exact: true })).toBeVisible();
    const wait = section(page);
    await expect(wait.locator(".fact", { hasText: "Repair completed" })).toContainText("Actual outage 6 hours");
    await expect(wait.locator(".fact", { hasText: "Possible shortfall" })).toContainText("540 g");
    await expect(wait.locator(".fact", { hasText: "Current forecast" })).toContainText("460 g");
    // The scenario switch no longer rewrites a recorded outage.
    await expect(wait.getByRole("button", { name: "2 hour outage" })).toBeDisabled();
    // The crusher is reported available, not verified.
    await page.goto("/equipment/eq-cr01");
    await expect(page.getByText(/Repair recorded as complete. Not yet independently verified/).first()).toBeVisible();

    await page.goto(issue);
    await section(page).getByRole("button", { name: "Record recovery" }).first().click();
    await page.getByLabel("Gold recovered (grams)").fill("200");
    await page.getByLabel("Production record or approved plan").fill("Extra shift on stockpiled ore, PR-0150");
    await page.getByRole("button", { name: "Record recovery" }).last().click();
    await expect(page.getByLabel("Messages").getByText("Recovery recorded", { exact: true })).toBeVisible();
    await expect(section(page).locator(".fact", { hasText: "Possible shortfall" })).toContainText("340 g");
    await expect(section(page).locator(".fact", { hasText: "Current forecast" })).toContainText("660 g");
    await section(page).getByText(/History of the estimate/).click();
    await expect(section(page)).toContainText("Repair complete");
    await expect(section(page)).toContainText("Recovery recorded");
  });

  test("can be reset to the start", async ({ page }) => {
    await openAs(page, issue, "John Dlamini");
    await choose(page, 6);
    await section(page).getByRole("button", { name: /Reset scenario/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reset scenario" }).click();
    await expect(page.getByText("Scenario reset", { exact: true })).toBeVisible();
    await expect(section(page).locator(".fact", { hasText: "Current forecast" })).toContainText("820 g");
  });
});

test.describe("who sees what", () => {
  test("operations see grams, hours and the next action, but no rand figure", async ({ page }) => {
    await openAs(page, issue, "Lebo Maseko");
    const wait = section(page);
    await expect(wait).toContainText("Up to 180 g");
    await expect(wait).toContainText("820 g");
    await expect(wait.getByText(/R \d/)).toHaveCount(0);
    await expect(wait).not.toContainText("Estimated sales value potentially delayed");
    await page.goto("/shipments/gold");
    await expect(page.getByText(/R \d/)).toHaveCount(0);
  });

  test("people who may not change the estimate are told so", async ({ page }) => {
    await openAs(page, issue, "Naledi Khoza");
    await expect(section(page)).toContainText("Only the Maintenance Planner, a Shift Supervisor or the Mine Manager can change the estimate");
    await expect(section(page).getByRole("button", { name: "Update repair estimate" })).toHaveCount(0);
    await actAs(page, "Amina Patel");
    await expect(section(page).getByRole("button", { name: "Update repair estimate" })).toBeVisible();
  });
});
