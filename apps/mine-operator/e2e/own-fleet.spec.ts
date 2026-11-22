/**
 * Browser test (Playwright, desktop Chrome and a phone). Transport handled by our own fleet: one complete example from assigning an
 * available vehicle and a driver, through readiness checks and the schedule confirmation, to dispatch and a confirmed delivery,
 * plus the cases that must be refused or flagged (unavailable vehicle, vehicle breakdown, no cost yet). Simulated data only.
 */
import { expect, test } from "@playwright/test";
import { actAs, openAs, pick } from "./support";

test.describe("transport handled by our own fleet", () => {
  test("one complete example: assign an available vehicle and driver, check readiness, dispatch and confirm delivery", async ({ page }) => {
    test.slow();
    await openAs(page, "/shipments/new", "Naledi Khoza");
    await expect(page.getByRole("button", { name: "Our fleet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Logistics provider" })).toBeVisible();
    await page.getByRole("button", { name: "Our fleet" }).click();
    await expect(page.getByLabel("Approved transporter")).toHaveCount(0);
    await page.getByLabel("Amount to reserve (t)").fill("200");
    await page.getByLabel("Customer or order reference").fill("PO-FLEET-1");
    await page.getByLabel("Preferred collection date").fill("2026-04-28");
    await page.getByRole("button", { name: "Create shipment" }).click();
    await expect(page.getByText("Shipment created", { exact: true })).toBeVisible();

    const fleet = page.getByRole("region", { name: "Our fleet" });
    await expect(fleet).toContainText("No vehicle or driver assigned yet");
    await expect(fleet).toContainText("no quote or agreement needed");
    await expect(page.getByRole("button", { name: "Mark ready", exact: true })).toBeVisible();

    // Assign a vehicle from the equipment register. An unavailable one cannot be chosen.
    await fleet.getByRole("button", { name: "Assign vehicle and driver" }).click();
    const dialog = page.getByRole("dialog");
    await pick(dialog.getByRole("combobox", { name: /^Vehicle/ }), { index: 1 });
    await pick(dialog.getByRole("combobox", { name: /^Driver/ }), "Thabo Molefe");
    await dialog.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.getByText("Load assigned").first()).toBeVisible();
    await expect(fleet.getByRole("row", { name: /HT-101/ })).toContainText("Thabo Molefe");
    await expect(fleet.getByRole("row", { name: /HT-101/ })).toContainText("Available");
    // Assigning did not make it ready or dispatched.
    await expect(page.getByText("Assigning a vehicle does not make the shipment ready, dispatched or delivered.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Record dispatch" })).toHaveCount(0);

    // Readiness: the four checks and a person responsible.
    for (const name of [/Quality/, /instructions/i, /documents/i, /Loading/]) await page.getByRole("checkbox", { name }).check();
    await pick(fleet.getByRole("combobox", { name: /^Responsible/ }), "John Dlamini");
    await expect(page.getByText("Saved").first()).toBeVisible();
    await page.getByRole("button", { name: "Mark ready", exact: true }).click();
    await expect(page.getByText(/Waiting for John Dlamini to confirm the schedule/)).toBeVisible();
    await page.getByRole("button", { name: "Confirm schedule" }).click();
    await expect(page.getByText("Schedule confirmed").first()).toBeVisible();
    await expect(page.getByText(/Collection confirmed:/)).toBeVisible();

    await page.getByLabel("Amount leaving the mine (t)").fill("200");
    await page.getByRole("button", { name: "Record dispatch" }).click();
    await expect(page.getByText("Dispatch recorded", { exact: true })).toBeVisible();
    await page.getByLabel("Amount received (t)").fill("200");
    await page.getByLabel("Delivery evidence").fill("DN-FLEET-1.pdf");
    await page.getByRole("button", { name: "Record delivery" }).click();
    await expect(page.getByText("Delivery recorded", { exact: true }).first()).toBeVisible();
  });

  test("shows 'Cost not yet assessed' until an estimate is entered, and keeps it separate from pricing", async ({ page }) => {
    await openAs(page, "/shipments/new", "John Dlamini");
    await page.getByRole("button", { name: "Our fleet" }).click();
    await page.getByLabel("Amount to reserve (t)").fill("100");
    await page.getByLabel("Customer or order reference").fill("PO-FLEET-2");
    await page.getByLabel("Preferred collection date").fill("2026-04-28");
    await page.getByRole("button", { name: "Create shipment" }).click();
    await expect(page.getByText("Shipment created", { exact: true })).toBeVisible();
    await expect(page.getByText("Cost not yet assessed. Optional.")).toBeVisible();
    await page.getByLabel("Estimated internal transport cost (R)").fill("12500");
    await page.getByLabel("What the estimate covers").fill("Fuel and driver time");
    await page.getByLabel("What the estimate covers").blur();
    await expect(page.getByText(/An internal estimate, kept apart from sales value/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Transport pricing" })).toHaveCount(0);
  });

  test("a vehicle that breaks down is linked to its load, with who is responsible and the next action", async ({ page }) => {
    test.slow();
    await openAs(page, "/shipments/new", "John Dlamini");
    await page.getByRole("button", { name: "Our fleet" }).click();
    await page.getByLabel("Amount to reserve (t)").fill("100");
    await page.getByLabel("Customer or order reference").fill("PO-FLEET-3");
    await page.getByLabel("Preferred collection date").fill("2026-04-28");
    await page.getByRole("button", { name: "Create shipment" }).click();
    await expect(page.getByText("Shipment created", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/shipments\/ship-\d+$/);
    const url = page.url();
    const fleet = page.getByRole("region", { name: "Our fleet" });
    await fleet.getByRole("button", { name: "Assign vehicle and driver" }).click();
    const dialog = page.getByRole("dialog");
    await pick(dialog.getByRole("combobox", { name: /^Vehicle/ }), { index: 1 });
    await pick(dialog.getByRole("combobox", { name: /^Driver/ }), "Thabo Molefe");
    await dialog.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.getByText("Load assigned").first()).toBeVisible();
    await pick(fleet.getByRole("combobox", { name: /^Responsible/ }), "John Dlamini");

    // The maintenance planner reports the truck unavailable on its equipment record.
    await page.goto("/equipment/eq-ht101");
    await actAs(page, "Lebo Maseko");
    await page.getByRole("button", { name: "Update availability" }).click();
    const state = page.getByRole("dialog");
    await state.getByLabel("Unavailable").check();
    await state.getByLabel("Reason").click();
    await page.getByRole("option", { name: "Mechanical fault" }).click();
    await state.getByLabel("Details").fill("Brake fault found at the gate.");
    await state.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Unavailable" })).toBeVisible();

    await actAs(page, "John Dlamini");
    await page.goto(url);
    const alert = page.getByRole("alert").filter({ hasText: "HT-101 is unavailable" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Responsible: John Dlamini");
    await expect(alert).toContainText("Next:");
  });
});
