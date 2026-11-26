/**
 * Browser test (Playwright, desktop Chrome and a phone). Service providers, transport quotes and transport agreements: the demonstration
 * data, a quote request from one shipment through to acceptance, an agreement and its allowance, and who may see commercial terms.
 * Everything is a manual, simulated record: nothing is sent to a provider. Runs against a production build; see scripts/run-e2e.mjs.
 */
import { expect, test } from "@playwright/test";
import { actAs, openAs, pick } from "./support";

test.describe("service providers", () => {
  test("shows the providers with the mine's approval, and Shipments no longer has a Logistics tab", async ({ page }) => {
    await openAs(page, "/shipments");
    await expect(page.getByRole("navigation", { name: "Shipments sections" }).getByRole("link", { name: "Logistics" })).toHaveCount(0);
    await page.goto("/shipments/logistics");
    await expect(page).toHaveURL(/\/shipments\/list$/);
    await page.goto("/shipments/providers");
    await expect(page.getByRole("heading", { name: "Service providers" })).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Service provider sections" });
    for (const name of ["Providers", "Transport quotes", "Transport agreements"]) await expect(tabs.getByRole("link", { name })).toBeVisible();
    await expect(page.getByRole("row", { name: /^ABC Logistics/ })).toContainText("Approved");
    await expect(page.getByRole("row", { name: /^Highveld Transport/ })).toContainText("Approved");
    await expect(page.getByRole("row", { name: /Metsi Logistics/ })).toContainText("Needs review");
  });

  test("the Mine Manager approves a provider that needs review; its history keeps it", async ({ page }) => {
    await openAs(page, "/shipments/providers");
    await page.getByRole("row", { name: /Metsi Logistics/ }).click();
    await expect(page.getByRole("heading", { name: "Metsi Logistics" })).toBeVisible();
    await expect(page.getByText(/waiting for the Mine Manager's approval/)).toBeVisible();
    await page.getByRole("button", { name: "Approve provider" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText("Provider approved").first()).toBeVisible();
    await expect(page.getByText(/Mine approval changed from Needs review to Approved/)).toBeVisible();
  });

  test("a new provider starts as Needs review and can be edited", async ({ page }) => {
    await openAs(page, "/shipments/providers", "Naledi Khoza");
    await page.getByRole("button", { name: "Add provider" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Company name").fill("Karoo Haulage");
    await dialog.getByLabel("Areas served").fill("Northern Cape, Gauteng");
    await dialog.getByLabel("Contact person").fill("Pieter Smit");
    await dialog.getByRole("button", { name: "Add provider" }).click();
    await expect(page).toHaveURL(/\/shipments\/providers\/tr-/);
    await expect(page.getByRole("heading", { name: "Karoo Haulage" })).toBeVisible();
    await expect(page.getByText("Needs review").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve provider" })).toHaveCount(0);
    await page.getByRole("button", { name: "Edit details" }).click();
    await page.getByRole("dialog").getByLabel("Phone").fill("+27 11 555 0100");
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Provider updated").first()).toBeVisible();
    await expect(page.getByText("+27 11 555 0100")).toBeVisible();
  });
});

test.describe("quotes", () => {
  test("shows the accepted ABC quote and the Highveld quote that was not selected for SHP-0048", async ({ page }) => {
    await openAs(page, "/shipments/providers/quotes");
    await page.getByRole("row", { name: /QR-0048/ }).click();
    await expect(page.getByRole("heading", { name: "QR-0048" })).toBeVisible();
    await expect(page.getByText("Demo period: April 2026")).toBeVisible();
    const abc = page.getByRole("row", { name: /^ABC Logistics/ });
    await expect(abc).toContainText("Accepted");
    await expect(abc).toContainText("R350 / t");
    await expect(abc).toContainText("R105,000");
    const highveld = page.getByRole("row", { name: /^Highveld Transport/ });
    await expect(highveld).toContainText("Not selected");
    await expect(highveld).toContainText("R114,000");
    await expect(page.getByText(/Collection is still unconfirmed/)).toBeVisible();
  });

  test("a quote request for one shipment goes from draft to a recorded acceptance that prices the shipment", async ({ page }) => {
    test.slow();
    await openAs(page, "/shipments/providers/quotes/new?shipment=ship-47");
    await expect(page.getByText("Richards Bay Terminal").first()).toBeVisible();
    await page.getByRole("checkbox", { name: /ABC Logistics/ }).check();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /^QR-00/ })).toBeVisible();
    await expect(page.getByLabel("Request text")).toContainText("Please reply by");
    await page.getByRole("button", { name: "Record request sent" }).click();
    await expect(page.getByText("Recorded as sent").first()).toBeVisible();
    await page.getByRole("button", { name: "Record quote" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Quote reference").fill("ABC-Q-77");
    await dialog.getByLabel("Valid until").fill("2099-01-01");
    await dialog.getByLabel("Rate per tonne (R)").fill("360");
    await dialog.getByRole("button", { name: "Save quote" }).click();
    await expect(page.getByText("Quote recorded").first()).toBeVisible();
    await expect(page.getByRole("row", { name: /^ABC Logistics/ })).toContainText("To review");
    await page.getByRole("button", { name: "Record acceptance" }).click();
    await page.getByRole("dialog").getByLabel("Reason (required)").fill("Best rate, fuel included.");
    await page.getByRole("dialog").getByRole("button", { name: "Record acceptance" }).click();
    await expect(page.getByText("Acceptance recorded").first()).toBeVisible();
    await expect(page.getByRole("row", { name: /^ABC Logistics/ })).toContainText("Accepted");
    await expect(page.getByText(/by John Dlamini/)).toBeVisible();
  });
});

test.describe("agreements", () => {
  test("AG-0001 shows its monthly allowance for April 2026 and the shipment that uses it", async ({ page }) => {
    await openAs(page, "/shipments/providers/agreements");
    await expect(page.getByRole("row", { name: /AG-0001/ })).toContainText("Active");
    await expect(page.getByRole("row", { name: /AG-0003/ })).toContainText("Draft");
    await page.getByRole("row", { name: /AG-0001/ }).click();
    await expect(page.getByRole("heading", { name: /AG-0001/ })).toBeVisible();
    await expect(page.getByText("1 Jan–31 Dec 2026 · 12 months")).toBeVisible();
    await expect(page.getByText("R1,000,000 / month").first()).toBeVisible();
    const allowance = page.getByRole("region", { name: "Allowance" });
    await expect(allowance.getByText("Allowance · April 2026")).toBeVisible();
    await expect(allowance.locator(".kpi").filter({ has: page.getByText("Included", { exact: true }) })).toContainText("10,000 t");
    await expect(allowance.locator(".kpi").filter({ has: page.getByText("Delivered", { exact: true }) })).toContainText("6,500 t");
    await expect(allowance.locator(".kpi").filter({ has: page.getByText("Planned", { exact: true }) })).toContainText("300 t");
    await expect(allowance.locator(".kpi").filter({ has: page.getByText("Available for new plans", { exact: true }) })).toContainText("3,200 t");
    const linked = page.getByRole("region", { name: "Linked shipments" });
    await expect(linked).toContainText("SHP-0051");
    await expect(linked).toContainText("300 ÷ 10,000 × R1,000,000 = R30,000");
    await expect(linked).toContainText("not an extra charge");
  });

  test("AG-0002 keeps yearly billing separate from the monthly allowance", async ({ page }) => {
    await openAs(page, "/shipments/providers/agreements");
    await page.getByRole("row", { name: /AG-0002/ }).click();
    const terms = page.getByRole("region", { name: "Terms" });
    await expect(terms.locator(".fact", { hasText: "Billing" })).toContainText("Yearly");
    await expect(terms.locator(".fact", { hasText: "Included quantity" })).toContainText("10,000 t per calendar month");
    await expect(terms.getByText(/no discount or advance payment is implied/)).toBeVisible();
  });

  test("a shipment shows where its transport price comes from, and an agreement for the wrong material is not offered", async ({ page }) => {
    await openAs(page, "/shipments/list");
    await page.getByRole("row", { name: /SHP-0051/ }).click();
    const pricing = page.getByRole("region", { name: "Transport pricing" });
    await expect(pricing).toContainText("Agreement AG-0001");
    await expect(pricing).toContainText("Allocated transport cost estimate");
    await expect(pricing).toContainText("R30,000");
    await expect(pricing).toContainText(/does not book a truck/);
    await page.goto("/shipments/list");
    await page.getByRole("row", { name: /SHP-0048/ }).click();
    const chrome = page.getByRole("region", { name: "Transport pricing" });
    await expect(chrome).toContainText("R105,000");
    await chrome.getByRole("button", { name: "Use transport agreement" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/No agreement covers this shipment/)).toBeVisible();
    await dialog.getByText(/cannot be used for this shipment/).click();
    await expect(dialog).toContainText(/coal/i);
  });

  test("an agreement is recorded as a draft and has to be confirmed by an authorised person", async ({ page }) => {
    await openAs(page, "/shipments/providers/agreements/new", "Naledi Khoza");
    await pick(page.getByRole("combobox", { name: /^Provider/ }), "ABC Logistics");
    await page.getByLabel("Agreement reference").fill("ABC-TA-2026-06");
    await page.getByLabel("Destination").fill("Rail Siding D");
    await page.getByLabel("Start date").fill("2026-06-01");
    await page.getByLabel("End date").fill("2027-05-31");
    await page.getByLabel("Fee (R)").fill("950000");
    await page.getByLabel("Included quantity (t)").fill("9000");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/Agreement recorded as a draft/).first()).toBeVisible();
    await expect(page.getByText(/cannot be applied to a shipment/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Review and confirm" })).toHaveCount(0);
    await actAs(page, "Zinhle Mahlangu");
    await page.getByRole("button", { name: "Review and confirm" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm agreement" }).click();
    await expect(page.getByText("Agreement confirmed").first()).toBeVisible();
    await expect(page.getByText("Terms reviewed and agreement confirmed")).toBeVisible();
  });
});

test.describe("who sees commercial terms", () => {
  test("a shift supervisor sees providers but not quotes, rates or agreements", async ({ page }) => {
    await openAs(page, "/shipments/providers", "Amina Patel");
    await expect(page.getByRole("row", { name: /^ABC Logistics/ })).toContainText("Approved");
    await expect(page.getByRole("button", { name: "Add provider" })).toHaveCount(0);
    await page.goto("/shipments/providers/quotes");
    await expect(page.getByText(/commercial information/)).toBeVisible();
    await expect(page.getByText("R350")).toHaveCount(0);
    await page.goto("/shipments/providers/agreements");
    await expect(page.getByText(/commercial information/)).toBeVisible();
    await expect(page.getByText("R1,000,000")).toHaveCount(0);
  });
});
