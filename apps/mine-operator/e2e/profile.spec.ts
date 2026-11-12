import { expect, test, type Page } from "@playwright/test";
import { FIXTURE_PASSWORD } from "../src/lib/accounts";
import { openAs, pick } from "./support";

test.describe("profiles and rights", () => {
  test.skip(({ isMobile }) => isMobile, "Profiles are exercised on the desktop layout.");

  const dialog = (page: Page) => page.getByRole("dialog");

  async function openOwnProfile(page: Page, name: string) {
    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.getByRole("link", { name: new RegExp(`Open the profile for ${name}`) }).click();
    await expect(page).toHaveURL(/\/profile$/);
  }

  test("opens a person's own profile from their name in the profile menu", async ({ page }) => {
    await openAs(page, "/overview", "Amina Patel");
    await openOwnProfile(page, "Amina Patel");
    await expect(page.getByRole("heading", { name: "Amina Patel", level: 1 })).toBeVisible();
    await expect(page.getByText("amina.patel@riverside.example").first()).toBeVisible();
    await expect(page.getByText(/rights come from your Shift Supervisor role/)).toBeVisible();
    await expect(page.getByText("Create, edit, cancel and delete shifts")).toBeVisible();
    // Their own profile gives no way to change their own role or rights.
    await expect(page.getByRole("button", { name: "Change role" })).toHaveCount(0);
  });

  test("lets the Mine Manager open their own profile too", async ({ page }) => {
    await openAs(page, "/equipment");
    await openOwnProfile(page, "John Dlamini");
    await expect(page.getByRole("heading", { name: "John Dlamini", level: 1 })).toBeVisible();
  });

  test("edits the person's own phone number", async ({ page }) => {
    await openAs(page, "/overview", "Lebo Maseko");
    await openOwnProfile(page, "Lebo Maseko");
    await page.getByRole("button", { name: "Edit phone" }).click();
    await dialog(page).getByLabel("Phone number").fill("+27 82 999 0000");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("+27 82 999 0000")).toBeVisible();
  });

  test("changes their own password and signs in with it", async ({ page }) => {
    await openAs(page, "/overview", "Naledi Khoza");
    await openOwnProfile(page, "Naledi Khoza");
    await page.getByLabel("Current password").fill("not-my-password");
    await page.getByLabel(/^New password/).fill("Quarry-Face-2025");
    await page.getByLabel("Confirm new password").fill("Quarry-Face-2025");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText(/current password is not correct/).first()).toBeVisible();

    await page.getByLabel("Current password").fill(FIXTURE_PASSWORD);
    await page.getByLabel(/^New password/).fill("weak");
    await page.getByLabel("Confirm new password").fill("weak");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText(/at least 10 characters/i).first()).toBeVisible();

    await page.getByLabel(/^New password/).fill("Quarry-Face-2025");
    await page.getByLabel("Confirm new password").fill("Quarry-Face-2025");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible();

    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.getByRole("button", { name: /Sign out/ }).click();
    await page.getByLabel("Email address").fill("naledi.khoza@riverside.example");
    await page.getByLabel("Password").fill(FIXTURE_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/do not match/)).toBeVisible();
    await page.getByLabel("Password").fill("Quarry-Face-2025");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("button", { name: /Account menu for Naledi Khoza/ })).toBeVisible();
  });

  test("changes another employee's role from their profile and shows what they gain and lose first", async ({ page }) => {
    await openAs(page, "/admin");
    await page.getByRole("link", { name: /Lebo Maseko/ }).click();
    await expect(page.getByText("Rights from the Maintenance Planner role")).toBeVisible();
    await page.getByRole("button", { name: "Change role" }).click();
    await expect(dialog(page).getByRole("button", { name: "Change role" })).toBeDisabled();
    await pick(dialog(page).getByLabel("Role"), "Field Employee");
    await expect(dialog(page).getByText(/Loses \(/)).toBeVisible();
    await expect(dialog(page).getByText("Add, edit, retire and delete equipment")).toBeVisible();
    await dialog(page).getByRole("button", { name: "Change role" }).click();
    await expect(page.getByText("Rights from the Field Employee role")).toBeVisible();
    await expect(page.getByText(/Changed Lebo Maseko: role to Field Employee/)).toBeVisible();
  });

  test("shows the Mine Manager no way to change their own role", async ({ page }) => {
    await openAs(page, "/admin");
    await page.getByRole("link", { name: /John Dlamini/ }).click();
    await expect(page.getByRole("button", { name: "Change role" })).toHaveCount(0);
    await expect(page.getByText(/You cannot change your own role/)).toBeVisible();
  });
});
