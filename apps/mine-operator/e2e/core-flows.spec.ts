import { expect, test } from "@playwright/test";

test("launches a clearly labelled simulated command centre", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByText("DEMO / SIMULATED DATA").first()).toBeVisible();
  await page.getByRole("button", { name: "Enter demonstration" }).click();
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole("heading", { name: /Crusher C-02/ })).toBeVisible();
  await expect(page.getByText("Opportunity not quantified")).toBeVisible();
});

test("opens the canonical issue and preserves verification separation", async ({ page }) => {
  await page.goto("/overview");
  await page.getByRole("link", { name: /View details/i }).click();
  await expect(page).toHaveURL(/\/exceptions\/issue-riv-001$/);
  await expect(page.getByText(/Repair completion, independent verification/)).toBeVisible();
});

test("shows the field report as pending while demo offline", async ({ page }) => {
  await page.goto("/mobile/report");
  await page.getByRole("button", { name: "Simulate offline" }).click();
  await page.getByLabel("Issue title").fill("Hydraulic leak observed");
  await page.getByLabel("Observed condition").fill("A small hydraulic leak was observed during the fictional pre-start inspection.");
  await page.getByRole("button", { name: "Save pending report" }).click();
  await expect(page.getByText("Pending Synchronisation")).toBeVisible();
  await expect(page.getByText(/has not been received centrally/)).toBeVisible();
});
