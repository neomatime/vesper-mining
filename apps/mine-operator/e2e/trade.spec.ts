/**
 * Browser test (Playwright, desktop Chrome and a phone). The Trade workspace: switching from the profile menu without signing in again,
 * deep links and refresh, the Trade sidebar, role restrictions (no Trade for operational roles, no prices for the Inventory Controller),
 * and the main commercial flows: an enquiry, customer acceptance, proof of delivery that fulfils nothing, an approval and Logistics.
 */
import { expect, test, type Page } from "@playwright/test";
import { actAs, openAs, pick, signIn } from "./support";

const menu = (page: Page) => page.getByRole("button", { name: /Account menu/ });

test.describe("workspace switching", () => {
  test("switches to Trade and back from the profile menu, keeping the session, the site and deep links", async ({ page }) => {
    await signIn(page);
    await page.goto("/overview");
    await menu(page).click();
    const section = page.getByRole("group", { name: "Switch workspace" });
    await expect(section.getByRole("button", { name: /Mining Operations/ })).toHaveAttribute("aria-current", "true");
    await section.getByRole("button", { name: /^Trade/ }).click();
    await expect(page).toHaveURL(/\/trade\/overview$/);
    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), John/, level: 1 })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Trade navigation" });
    for (const item of ["Overview", "Portfolio", "Enquiries", "Agreements", "Deliveries", "Logistics", "Settlements", "Approvals", "Documents", "Linked Operations", "Reports"]) {
      await expect(nav.getByRole("link", { name: item, exact: true })).toBeVisible();
    }
    await expect(page.getByText("VESPER Trade")).toBeVisible();

    // A deep link survives a refresh, with the same person signed in.
    await page.goto("/trade/agreements/ag-47");
    await page.reload();
    await expect(page.getByRole("heading", { name: /AGR-0047/, level: 1 })).toBeVisible();
    await expect(menu(page)).toContainText("John Dlamini");

    await menu(page).click();
    await expect(page.getByRole("group", { name: "Switch workspace" }).getByRole("button", { name: /^Trade/ })).toHaveAttribute("aria-current", "true");
    await page.getByRole("group", { name: "Switch workspace" }).getByRole("button", { name: /Mining Operations/ }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByRole("navigation", { name: "Primary workspaces" }).getByRole("link", { name: "Work & Exceptions" })).toBeVisible();
  });

  test("is not offered to operational roles, and a Trade link explains instead of showing records", async ({ page }) => {
    await openAs(page, "/overview", "Amina Patel");
    await menu(page).click();
    await expect(page.getByRole("group", { name: "Switch workspace" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.goto("/trade/agreements");
    await expect(page.getByRole("heading", { name: "Trade is not part of your role" })).toBeVisible();
    await expect(page.getByText("AGR-0047")).toHaveCount(0);
  });
});

test.describe("trade records", () => {
  test("hides prices from the Inventory Controller but shows deliveries and quantities", async ({ page }) => {
    await openAs(page, "/trade/agreements/ag-47", "Naledi Khoza");
    await expect(page.getByRole("heading", { name: /AGR-0047/, level: 1 })).toBeVisible();
    await expect(page.getByText("Restricted").first()).toBeVisible();
    await expect(page.getByText("R 3,150/t")).toHaveCount(0);
    await page.goto("/trade/settlements");
    await expect(page.getByText(/Amounts are restricted to the Mine Manager/)).toBeVisible();
  });

  test("searches, filters and pages through agreements", async ({ page }) => {
    await openAs(page, "/trade/agreements");
    await expect(page.getByText(/Showing 1 – 8 of 10 agreements/)).toBeVisible();
    await page.getByRole("button", { name: "Page 2" }).click();
    await expect(page.getByText(/Showing 9 – 10 of 10 agreements/)).toBeVisible();
    await page.getByRole("group", { name: "Filter agreements" }).getByRole("button", { name: "At risk" }).click();
    await expect(page.getByRole("row", { name: /AGR-0042/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /AGR-0047/ })).toHaveCount(0);
    await page.getByLabel("Search agreements by reference, customer or commodity").fill("zzzz");
    await expect(page.getByText("No agreements match these filters")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText(/Showing 1 – 8 of 10 agreements/)).toBeVisible();
  });

  test("logs an enquiry and refuses an open duplicate", async ({ page }) => {
    test.slow();
    await openAs(page, "/trade/enquiries", "Zinhle Mahlangu");
    await page.getByRole("button", { name: "New enquiry" }).click();
    const dialog = page.getByRole("dialog");
    await pick(dialog.getByLabel("Client"), "Bayside Metals");
    await dialog.getByLabel("Requested quantity (t)").fill("900");
    await dialog.getByLabel("Delivery window").fill("Aug 2025");
    await dialog.getByRole("button", { name: "Log enquiry" }).click();
    await expect(page.getByText("Enquiry logged").first()).toBeVisible();
    await expect(page.getByRole("row", { name: /ENQ-0106/ })).toContainText("Bayside Metals");

    await page.getByRole("button", { name: "New enquiry" }).click();
    await pick(page.getByRole("dialog").getByLabel("Client"), "Bayside Metals");
    await page.getByRole("dialog").getByLabel("Requested quantity (t)").fill("900");
    await page.getByRole("dialog").getByLabel("Delivery window").fill("Aug 2025");
    await page.getByRole("dialog").getByRole("button", { name: "Log enquiry" }).click();
    await expect(page.getByText(/This looks like ENQ-0106/).first()).toBeVisible();
  });

  test("proof of delivery is evidence only; customer acceptance is recorded separately", async ({ page }) => {
    test.slow();
    await openAs(page, "/trade/deliveries/ag-47-apr-45", "Zinhle Mahlangu");
    await expect(page.getByRole("heading", { name: /DEL-\d+/, level: 1 })).toContainText("Awaiting acceptance");
    await page.getByRole("button", { name: /Actions for DEL-/ }).click();
    await page.getByRole("button", { name: "Upload evidence" }).click();
    await page.getByRole("dialog").locator('input[type="file"]').setInputFiles({ name: "POD-signed.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 demo") });
    await page.getByRole("dialog").getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText("Document uploaded").first()).toBeVisible();
    // Still awaiting acceptance: uploading proof of delivery changed nothing.
    await expect(page.getByRole("heading", { name: /DEL-\d+/, level: 1 })).toContainText("Awaiting acceptance");

    await page.getByRole("button", { name: "Record acceptance" }).click();
    await page.getByRole("dialog").getByLabel("Accepted by the customer (t)").fill("580");
    await expect(page.getByRole("dialog").getByRole("button", { name: "Record acceptance" })).toBeDisabled();
    await page.getByRole("dialog").getByLabel(/Why were 20 t not accepted/).fill("Moisture above the agreed limit.");
    await page.getByRole("dialog").getByRole("button", { name: "Record acceptance" }).click();
    await expect(page.getByText("Customer acceptance recorded").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /DEL-\d+/, level: 1 })).toContainText("Discrepancy");
    await expect(page.getByRole("article", { name: "Quantity reconciliation" })).toContainText("580 t");
  });

  test("an approval cannot be self-approved; the Mine Manager approves and the agreement goes live", async ({ page }) => {
    test.slow();
    await openAs(page, "/trade/approvals", "Zinhle Mahlangu");
    await page.getByRole("button", { name: /View APP-0101/ }).click();
    await expect(page.getByRole("dialog")).toContainText("You asked for this approval");
    await page.keyboard.press("Escape");

    await actAs(page, "John Dlamini");
    await page.goto("/trade/approvals");
    await page.getByRole("button", { name: /Review APP-0101/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("APP-0101 approved").first()).toBeVisible();
    await page.goto("/trade/agreements/ag-49");
    await expect(page.getByRole("heading", { name: /AGR-0049/, level: 1 })).toContainText("Active");
  });

  test("Logistics shows the shared transport records and opens them inside Trade", async ({ page }) => {
    await openAs(page, "/trade/logistics");
    await expect(page.getByRole("tab", { name: /Service Providers/ })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("row", { name: /ABC Logistics/ }).getByRole("link", { name: /View ABC Logistics/ }).click();
    await expect(page).toHaveURL(/\/trade\/logistics\/tr-001$/);
    await expect(page.getByRole("navigation", { name: "Trade navigation" })).toBeVisible();
    await page.goto("/trade/logistics?tab=agreements");
    await expect(page.getByRole("tab", { name: /Transport Agreements/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("row", { name: /AG-0001/ })).toBeVisible();
  });
});
