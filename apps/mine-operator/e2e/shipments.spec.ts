/**
 * Browser test (Playwright, desktop Chrome and a phone). Production, mineral inventory, shipments and logistics: the agreed
 * workflow from a reported amount to a confirmed delivery, and the blocked and repeated cases around it.
 * Runs against a production build; see playwright.config.ts and scripts/run-e2e.mjs.
 */
import { expect, test, type Page } from "@playwright/test";
import { actAs, openAs } from "./support";

const tonnes = (page: Page, text: string) => expect(page.getByText(text).first()).toBeVisible();

test.describe("navigation", () => {
  test("puts Shipments beneath Shift Control, with the agreed tabs in each module", async ({ page }) => {
    await openAs(page, "/shifts");
    const nav = page.getByRole("navigation").first();
    await expect(nav.getByRole("link", { name: "Shift Control" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Shipments" })).toBeVisible();
    const shiftTabs = page.getByRole("navigation", { name: "Shift Control sections" });
    for (const name of ["Shifts", "Production", "Handover", "Exceptions", "Reports"]) await expect(shiftTabs.getByRole("link", { name })).toBeVisible();
    await page.goto("/shipments");
    const tabs = page.getByRole("navigation", { name: "Shipments sections" });
    for (const name of ["Overview", "Mineral Inventory", "Shipments", "Logistics", "History"]) await expect(tabs.getByRole("link", { name })).toBeVisible();
  });

  test("the Handover tab is its own page: it keeps the tabs and shows the sender, the receiver, production, carried work and the note", async ({ page }) => {
    await openAs(page, "/shifts", "Amina Patel");
    await page.getByRole("navigation", { name: "Shift Control sections" }).getByRole("link", { name: "Handover" }).click();
    await expect(page).toHaveURL(/\/shifts\/handover$/);
    await expect(page.getByRole("heading", { name: "Handover", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Shift Control sections" }).getByRole("link", { name: "Handover" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Shift A to Shift B" })).toBeVisible();
    await expect(page.getByText("Sender (from shift)")).toBeVisible();
    await expect(page.getByText("Receiver (to shift)")).toBeVisible();
    await expect(page.getByRole("heading", { name: "1. Production" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2. Work to carry forward" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "3. Note for the next team" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send handover" })).toBeVisible();
    await expect(page.getByText(/will be asked to confirm receipt/)).toBeVisible();
  });

  test("opens the Shift Control Exceptions and Reports tabs from the existing records", async ({ page }) => {
    await openAs(page, "/shifts/exceptions");
    await expect(page.getByRole("heading", { name: "Exceptions" })).toBeVisible();
    await expect(page.getByText("Showing shift issues from Work & Exceptions.")).toBeVisible();
    await page.goto("/shifts/reports");
    await expect(page.getByRole("heading", { name: "Shift reports" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Production summary" })).toBeVisible();
  });
});

test.describe("production and inventory", () => {
  test("a supervisor records production, and it is not stock until someone checks it", async ({ page }) => {
    await openAs(page, "/shifts/production", "Amina Patel");
    await expect(page.getByRole("heading", { name: "Production", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Record production" }).click();
    await expect(page.getByRole("heading", { name: "Record production" })).toBeVisible();
    await page.getByLabel("Amount produced (t)").fill("700");
    await page.getByRole("button", { name: "Send for checking" }).click();
    await expect(page.getByText("Sent for checking").first()).toBeVisible();
    await expect(page).toHaveURL(/\/shifts\/production$/);
    await expect(page.getByRole("row", { name: /PR-0149/ })).toContainText("Needs checking");
    // Stock has not moved.
    await page.goto("/shipments/inventory");
    await tonnes(page, "2,000 t");
  });

  test("asks for the amount before sending, and keeps what was typed when something is wrong", async ({ page }) => {
    await openAs(page, "/shifts/production/new", "Amina Patel");
    await page.getByRole("button", { name: "Send for checking" }).click();
    await expect(page.getByText("Enter how many tonnes were produced.").first()).toBeVisible();
    await expect(page).toHaveURL(/production\/new/);
  });

  test("the Inventory Controller confirms the amount, records the difference, and stock moves into the chosen stockpile", async ({ page }) => {
    await openAs(page, "/shifts/production", "Naledi Khoza");
    await page.getByRole("row", { name: /PR-0148/ }).getByRole("link", { name: "PR-0148" }).click();
    await expect(page.getByRole("heading", { name: "Check production" })).toBeVisible();
    await page.getByLabel("Confirmed amount (t)").fill("1060");
    await page.getByLabel("Measurement record").fill("WB-0148.pdf");
    await expect(page.getByText(/20 t less than reported/)).toBeVisible();
    // A difference needs a reason.
    await page.getByRole("button", { name: "Confirm receipt" }).click();
    await expect(page.getByText("Record the reason for the difference.")).toBeVisible();
    await page.getByLabel("Reason").fill("Scale measurement replaced the shift estimate.");
    await expect(page.getByText(/After confirmation: 1,060 t added to SP-02/)).toBeVisible();
    await page.getByRole("button", { name: "Confirm receipt" }).click();
    await expect(page.getByText("Receipt confirmed", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/shipments\/inventory$/);
    // The 1,060 t sits in SP-02 and needs processing; the finished stock in SP-01 is untouched.
    await expect(page.getByRole("row", { name: /SP-02/ })).toContainText("1,060 t");
    await expect(page.getByRole("row", { name: /SP-02/ })).toContainText("Needs processing");
    await expect(page.getByRole("row", { name: /SP-02/ })).toContainText("0 t");
    // The original report stays on the record.
    await page.goto("/shifts/production");
    await expect(page.getByRole("row", { name: /PR-0148/ })).toContainText("1,080 t");
    await expect(page.getByRole("row", { name: /PR-0148/ })).toContainText("Checked");
  });

  test("only the Inventory Controller or Mine Manager can check, and never the person who reported the amount", async ({ page }) => {
    await openAs(page, "/shipments/inventory/check/prod-148", "Amina Patel");
    await expect(page.getByText(/Checking a quantity is done by the Inventory Controller or the Mine Manager/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm receipt" })).toHaveCount(0);
    // The Mine Manager may record and may check, but not the same amount.
    await actAs(page, "John Dlamini");
    await page.goto("/shifts/production/new");
    await page.getByLabel("Amount produced (t)").fill("650");
    await page.getByRole("button", { name: "Send for checking" }).click();
    await expect(page).toHaveURL(/\/shifts\/production$/);
    await page.goto("/shipments/inventory/check/prod-149");
    await expect(page.getByText(/Someone other than the person who reported the amount must check it/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm receipt" })).toHaveCount(0);
  });
});

test.describe("shipments and logistics", () => {
  test("shows what is available, refuses more than that, and reserves exactly what was asked", async ({ page }) => {
    await openAs(page, "/shipments/new", "Naledi Khoza");
    await page.getByLabel("Amount to reserve (t)").fill("900");
    await expect(page.getByText("Only 800 t is available. Reduce the amount.")).toBeVisible();
    await page.getByLabel("Amount to reserve (t)").fill("300");
    await expect(page.getByText("800 t available · 300 t for this shipment · 500 t left")).toBeVisible();
    await page.getByLabel("Customer or order reference").fill("PO-2049");
    await page.getByLabel("Preferred collection date").fill("2025-04-28");
    await expect(page.getByText(/Creates SHP-00\d+ and reserves 300 t/)).toBeVisible();
    await page.getByRole("button", { name: "Create shipment" }).click();
    await expect(page.getByText("Shipment created", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Shipment readiness" })).toBeVisible();
    await page.goto("/shipments/inventory");
    await expect(page.getByRole("row", { name: /SP-01/ })).toContainText("1,500 t");
    await expect(page.getByRole("row", { name: /SP-01/ })).toContainText("500 t");
  });

  test("lists only stock that is ready to ship", async ({ page }) => {
    await openAs(page, "/shipments/new", "Naledi Khoza");
    await page.getByLabel("Stockpile").click();
    const options = page.getByRole("listbox").getByRole("option");
    // Only stock that is ready to ship: the finished chrome and the coal. Not the stock that still needs processing.
    await expect(options).toHaveCount(2);
    await expect(options.first()).toContainText("SP-01");
    await expect(options.nth(1)).toContainText("SP-03");
  });

  test("marking a shipment ready creates exactly one request, and only the transporter's reply confirms it", async ({ page, context }) => {
    await openAs(page, "/shipments", "Naledi Khoza");
    await expect(page.getByRole("row", { name: /SHP-0048/ })).toContainText("Preparing");
    await page.goto("/shipments/ship-48");
    await expect(page.getByRole("heading", { name: "Shipment readiness" })).toBeVisible();
    await page.getByRole("button", { name: /Mark ready & notify transporter/ }).click();
    await expect(page.getByText("Collection request recorded", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Waiting for ABC Logistics/ })).toBeVisible();

    await page.goto("/shipments/logistics");
    await expect(page.getByRole("row", { name: /SHP-0048/ })).toHaveCount(1);
    await expect(page.getByRole("row", { name: /SHP-0048/ })).toContainText("Waiting for reply");
    await expect(page.getByText(/nothing is sent to a real transporter/i)).toBeVisible();

    // The shipment is not booked until the transporter replies, on its own page with no sign-in.
    const reply = await context.newPage();
    await page.goto("/shipments/ship-48");
    const href = await page.getByRole("link", { name: /Open reply page/ }).getAttribute("href");
    await reply.goto(href!);
    await expect(reply.getByRole("heading", { name: /needs a collection/ })).toBeVisible();
    await reply.getByLabel("Collection date").fill("2025-04-28");
    await reply.getByRole("button", { name: "Confirm collection" }).click();
    await expect(reply.getByText(/Collection is confirmed/)).toBeVisible();

    await page.goto("/shipments/list");
    await expect(page.getByRole("row", { name: /SHP-0048/ })).toContainText("Collection confirmed");
    await page.goto("/shipments/logistics");
    await expect(page.getByRole("row", { name: /SHP-0048/ })).toContainText("Confirmed");
  });

  test("a declined request returns the shipment to preparation, and a second request can be sent", async ({ page, context }) => {
    await openAs(page, "/shipments/ship-48", "Naledi Khoza");
    await page.getByRole("button", { name: /Mark ready & notify transporter/ }).click();
    await expect(page.getByRole("heading", { name: /Waiting for ABC Logistics/ })).toBeVisible();
    const href = await page.getByRole("link", { name: /Open reply page/ }).getAttribute("href");
    const reply = await context.newPage();
    await reply.goto(href!);
    await reply.getByRole("button", { name: "Decline", exact: true }).click();
    await reply.getByLabel("Why can you not collect?").fill("No trucks available that day.");
    await reply.getByRole("button", { name: "Send decline" }).click();
    await expect(reply.getByText(/You declined this request/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/ABC Logistics declined\./).first()).toBeVisible();
    await page.getByRole("button", { name: /Mark ready & notify transporter/ }).click();
    await expect(page.getByRole("heading", { name: /Waiting for ABC Logistics/ })).toBeVisible();
    await page.goto("/shipments/logistics");
    await expect(page.getByRole("row", { name: /SHP-0048/ })).toHaveCount(2);
  });

  test("dispatch and delivery stay traceable: a partial load, a short delivery with a reason, and a difference to review", async ({ page }) => {
    await openAs(page, "/shipments/ship-46", "Naledi Khoza");
    await expect(page.getByText(/Collection confirmed:/)).toBeVisible();
    await page.getByLabel("Amount leaving the mine (t)").fill("200");
    await page.getByRole("button", { name: "Record dispatch" }).click();
    await expect(page.getByText("Dispatch recorded", { exact: true })).toBeVisible();
    // 300 t is still at the mine: the shipment is not fully dispatched by its first load.
    await expect(page.locator(".fact", { hasText: "Still at the mine" })).toHaveText(/Still at the mine\s*300 t/);
    await page.getByLabel("Amount leaving the mine (t)").fill("300");
    await page.getByRole("button", { name: "Record dispatch" }).click();
    await expect(page.locator(".fact", { hasText: "Still at the mine" })).toHaveText(/Still at the mine\s*0 t/);

    await page.getByLabel("Amount received (t)").fill("490");
    await page.getByLabel("Delivery evidence").fill("DN-0046.pdf");
    await expect(page.getByText(/10 t less arrived than was dispatched/)).toBeVisible();
    await page.getByLabel("Reason for the difference").fill("Some spillage on the haul road.");
    await page.getByRole("button", { name: "Record delivery" }).click();
    await expect(page.getByText("Delivery recorded", { exact: true })).toBeVisible();
    await expect(page.getByText("Difference to review").first()).toBeVisible();
    await page.getByRole("button", { name: "Mark reviewed" }).click();
    await expect(page.getByText(/Reviewed by Naledi Khoza/)).toBeVisible();

    await page.goto("/shipments/history");
    await expect(page.getByRole("row", { name: /SHP-0046/ })).toContainText("490 t");
  });

  test("cancelling before dispatch releases the reserved stock", async ({ page }) => {
    await openAs(page, "/shipments/ship-47", "Naledi Khoza");
    await page.getByRole("button", { name: "Cancel shipment" }).first().click();
    await page.getByLabel("Why is it being cancelled?").fill("The customer postponed the order.");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel shipment" }).click();
    await expect(page.getByText("Shipment cancelled", { exact: true })).toBeVisible();
    await page.goto("/shipments/inventory");
    await expect(page.getByRole("row", { name: /SP-01/ })).toContainText("1,200 t");
    await page.goto("/shipments/history");
    await expect(page.getByRole("row", { name: /SHP-0047/ })).toContainText("Cancelled");
  });

  test("keeps people without the right role out of the actions, not only out of sight", async ({ page }) => {
    await openAs(page, "/shipments/ship-48", "Amina Patel");
    await expect(page.getByText(/Shipments are managed by the Inventory Controller or the Mine Manager/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Mark ready & notify transporter/ })).toHaveCount(0);
    await page.goto("/shipments/new");
    await expect(page.getByText("This step is for the Inventory Controller")).toBeVisible();
  });

  test("shows the shipments in plain words on the overview", async ({ page }) => {
    await openAs(page, "/shipments");
    await expect(page.getByRole("heading", { name: "Shipment overview" })).toBeVisible();
    await expect(page.getByText("A request is not a booking until the transporter confirms.")).toBeVisible();
    await expect(page.getByRole("row", { name: /SHP-0047/ })).toContainText("Waiting for transporter");
    await expect(page.getByRole("row", { name: /SHP-0046/ })).toContainText("Collection confirmed");
  });
});

test.describe("closing a shift", () => {
  test("sends the handover with the close, and leaves receipt for the next supervisor", async ({ page }) => {
    await openAs(page, "/shifts/shift-a-20250424/close", "Amina Patel");
    await expect(page.getByRole("heading", { name: "Close shift" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Production/ })).toBeVisible();
    await expect(page.getByText("Checking can continue after the shift closes.")).toBeVisible();
    await expect(page.getByText(/will still need to confirm receipt/)).toBeVisible();
    await page.getByLabel("I have reviewed the handover.").check();
    await page.getByRole("button", { name: "Close shift & send handover" }).click();
    await expect(page.getByText(/Shift A closed/)).toBeVisible();
    await actAs(page, "Sipho Nkosi");
    await page.goto("/shifts/shift-a-20250424/handover");
    await expect(page.getByRole("button", { name: "Confirm receipt" })).toBeEnabled();
  });
});
