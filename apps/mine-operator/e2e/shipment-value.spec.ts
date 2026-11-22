/**
 * Browser test (Playwright, desktop Chrome and a phone). Sales value on shipments: where it is shown, how it is explained, who sees
 * it, and how a price change keeps the original estimate. Runs against a production build; see playwright.config.ts.
 */
import { expect, test } from "@playwright/test";
import { actAs, openAs } from "./support";

test.describe("value beside the operational status", () => {
  test("the Mine Manager sees an estimated sales value on the list, with how firm it is", async ({ page }) => {
    await openAs(page, "/shipments/list", "John Dlamini");
    // On a phone the table becomes cards and its header row is hidden, so check the column exists rather than that it is on screen.
    await expect(page.locator("th", { hasText: "Estimated sales value" })).toHaveCount(1);
    await expect(page.getByRole("row", { name: /SHP-0046/ })).toContainText("R 925,000");
    await expect(page.getByRole("row", { name: /SHP-0046/ })).toContainText("Estimated");
    await expect(page.getByRole("row", { name: /SHP-0047/ })).toContainText("R 740,000");
    await expect(page.getByRole("row", { name: /SHP-0048/ })).toContainText("Not priced");
  });

  test("the overview totals are defined, do not overlap, and do not call a delay a loss", async ({ page }) => {
    await openAs(page, "/shipments", "John Dlamini");
    await expect(page.locator(".kpi", { hasText: "Value awaiting collection" })).toContainText("R 925,000");
    await expect(page.locator(".kpi", { hasText: "Value of delayed shipments" })).toContainText("R 740,000");
    await expect(page.getByText(/Each shipment is counted once/)).toBeVisible();
    await expect(page.getByText(/not a loss/)).toBeVisible();
    // The value sits beside the status, blocker, responsible person and next action.
    const row = page.getByRole("row", { name: /SHP-0047/ });
    await expect(row).toContainText("Waiting for transporter");
    await expect(row).toContainText("Waiting for ABC Logistics to reply");
    await expect(row).toContainText("ABC Logistics");
    await expect(row).toContainText("R 740,000");
    await expect(row.getByRole("link", { name: "View request" })).toBeVisible();
  });

  test("a shipment's Value section explains the basis, price, source and history, and keeps money lines apart", async ({ page }) => {
    await openAs(page, "/shipments/ship-46", "John Dlamini");
    const value = page.getByRole("region", { name: "Value" });
    await expect(value).toContainText("R 925,000");
    await expect(value).toContainText("Tonnes dispatched from the mine");
    await expect(value).toContainText("R 1,850 per tonne");
    await expect(value).toContainText("ZAR");
    await expect(value).toContainText("Contract CT-2025-014, price list 2");
    await expect(value).toContainText("It is not revenue and not cash.");
    await expect(value).toContainText("Transport cost");
    await expect(value).toContainText("Accounting revenue");
    await expect(value).toContainText("Cash received");
    // The price went up after the shipment was created. The original estimate is kept.
    await value.getByText(/Value history/).click();
    await expect(value).toContainText("Original estimate");
    await expect(value).toContainText("R 900,000");
    await expect(value).toContainText("Price changed");
  });

  test("finance records show revenue and payment as finance holds them", async ({ page }) => {
    await openAs(page, "/shipments/ship-44", "John Dlamini");
    const value = page.getByRole("region", { name: "Value" });
    await expect(value).toContainText("Final");
    await expect(value).toContainText("R 832,500");
    await expect(value).toContainText("INV-5521");
    await expect(value).toContainText("Paid");
    await expect(value).toContainText("R 36,000");
    await page.goto("/shipments/ship-45");
    await expect(page.getByRole("region", { name: "Value" })).toContainText("Provisional");
    await expect(page.getByRole("region", { name: "Value" })).toContainText("Not recognised yet");
    await expect(page.getByRole("region", { name: "Value" })).toContainText("Not provided");
  });
});

test.describe("who sees money", () => {
  test("operations see tonnes and status but no price, value or total", async ({ page }) => {
    await openAs(page, "/shipments/list", "Naledi Khoza");
    await expect(page.getByRole("columnheader", { name: "Estimated sales value" })).toHaveCount(0);
    await expect(page.getByText("R 925,000")).toHaveCount(0);
    await page.goto("/shipments");
    await expect(page.getByText("Value awaiting collection")).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Sales value" })).toHaveCount(0);
    await expect(page.getByRole("row", { name: /SHP-0047/ })).toContainText("Waiting for ABC Logistics to reply");
    await page.goto("/shipments/ship-46");
    await expect(page.getByRole("region", { name: "Value" })).toHaveCount(0);
    await expect(page.getByText(/per tonne/)).toHaveCount(0);
  });

  test("the transporter's page shows the request and no money", async ({ page, context }) => {
    await openAs(page, "/shipments/ship-47", "John Dlamini");
    const href = await page.getByRole("link", { name: /Open reply page/ }).getAttribute("href");
    const reply = await context.newPage();
    await reply.goto(href!);
    await expect(reply.getByRole("heading", { name: /needs a collection/ })).toBeVisible();
    await expect(reply.getByText(/R \d/)).toHaveCount(0);
    await expect(reply.getByText(/price|value|revenue/i)).toHaveCount(0);
  });
});

test.describe("supplying a price", () => {
  test("only the Commercial / Finance Officer can set a price, and the original estimate is kept", async ({ page }) => {
    await openAs(page, "/shipments/ship-48", "John Dlamini");
    await expect(page.getByRole("region", { name: "Value" })).toContainText("Not priced");
    await expect(page.getByRole("button", { name: "Set price" })).toHaveCount(0);

    await actAs(page, "Zinhle Mahlangu");
    await page.goto("/shipments/ship-48");
    await page.getByRole("button", { name: "Set price" }).click();
    await page.getByLabel("Price per tonne (ZAR)").fill("1850");
    await page.getByLabel("Source of the price").fill("Contract CT-2025-014, price list 2");
    await page.getByRole("button", { name: "Save price" }).click();
    await expect(page.getByText("Price supplied", { exact: true })).toBeVisible();
    const value = page.getByRole("region", { name: "Value" });
    await expect(value).toContainText("R 555,000");
    await expect(value).toContainText("Estimated");
    await value.getByText(/Value history/).click();
    await expect(value).toContainText("Not priced");
    await expect(value).toContainText("Price supplied");

    // The new price shows everywhere the shipment's value is shown.
    await page.goto("/shipments/list");
    await expect(page.getByRole("row", { name: /SHP-0048/ })).toContainText("R 555,000");
  });
});

test.describe("internal transfers", () => {
  test("have no sales value and say so", async ({ page }) => {
    await openAs(page, "/shipments/new", "John Dlamini");
    await page.getByLabel("Type of shipment").click();
    await page.getByRole("listbox").getByRole("option", { name: "Internal transfer" }).click();
    await expect(page.getByText(/It has no sales value/)).toBeVisible();
    await page.getByLabel("Amount to reserve (t)").fill("100");
    await page.getByLabel("Transfer reference").fill("TR-0001");
    await page.getByLabel("Preferred collection date").fill("2025-04-28");
    await page.getByRole("button", { name: "Create shipment" }).click();
    await expect(page.getByRole("region", { name: "Value" })).toContainText("internal transfer");
    await page.goto("/shipments/list");
    await expect(page.getByRole("row", { name: /TR-0001|SHP-0049/ })).toContainText("Internal transfer");
  });
});
