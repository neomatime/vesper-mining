import { expect, test } from "@playwright/test";
import { signIn } from "./support";

test.describe("role homes", () => {
  test("a shift supervisor lands on their shift, not on the manager's overview", async ({ page }) => {
    await signIn(page, "Amina Patel");
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByRole("heading", { name: "Good morning, Amina" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Shift A · 06:00–14:00/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Write the handover/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Crew on this shift" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Work for this shift" })).toBeVisible();
    await expect(page.getByText("Production vs plan")).toHaveCount(0);
    await expect(page.getByText("Recovery status")).toHaveCount(0);
  });

  test("a supervisor whose shift has not started sees it as scheduled", async ({ page }) => {
    await signIn(page, "Sipho Nkosi");
    await expect(page.getByRole("heading", { name: /Shift B · 14:00–22:00/ })).toBeVisible();
    await expect(page.getByText("Scheduled", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Open the shift/ })).toBeVisible();
  });

  test("the maintenance planner sees equipment and services, never a shift handover", async ({ page }) => {
    await signIn(page, "Lebo Maseko");
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByRole("heading", { name: "Good morning, Lebo" })).toBeVisible();
    await expect(page.getByLabel("Summary").getByText("Equipment available")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Services coming up" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Equipment that is down" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Write the handover/ })).toHaveCount(0);
  });

  test("stores sees the parts to check and never shows unconfirmed stock as zero", async ({ page }) => {
    await signIn(page, "Naledi Khoza");
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByRole("heading", { name: "Good morning, Naledi" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Parts to check" })).toBeVisible();
    await expect(page.getByText("Stock not confirmed").first()).toBeVisible();
    await expect(page.getByText(/\b0 on hand/)).toHaveCount(0);
  });

  test("the mine manager keeps the full overview", async ({ page }) => {
    await signIn(page, "John Dlamini");
    await expect(page.getByRole("heading", { name: "Good morning, John" })).toBeVisible();
    await expect(page.getByText("Recovery status")).toBeVisible();
    await expect(page.getByText("Production vs plan")).toBeVisible();
  });

  test("each home's main button leads somewhere real", async ({ page }) => {
    await signIn(page, "Lebo Maseko");
    const lead = page.locator(".hero-card").getByRole("link").first();
    const href = await lead.getAttribute("href");
    expect(href).toMatch(/^\/(exceptions|equipment|resources)\//);
    await lead.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });
});
