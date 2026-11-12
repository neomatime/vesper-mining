import { expect, test, type Page } from "@playwright/test";
import { FIXTURE_PASSWORD } from "../src/lib/accounts";
import { openAs } from "./support";

test.describe("administration", () => {
  test.skip(({ isMobile }) => isMobile, "Administration is exercised on the desktop layout.");

  const dialog = (page: Page) => page.getByRole("dialog");
  const row = (page: Page, name: string) => page.getByRole("row", { name: new RegExp(name) });
  const email = "zanele.mokoena@riverside.example";

  async function invite(page: Page, role = "Maintenance Planner") {
    await page.getByRole("button", { name: "Invite person" }).click();
    await dialog(page).getByLabel("Full name").fill("Zanele Mokoena");
    await dialog(page).getByLabel("Work email address").fill(email);
    await dialog(page).getByLabel("Role").selectOption(role);
    await dialog(page).getByRole("button", { name: "Send invitation" }).click();
    await expect(row(page, "Zanele Mokoena")).toBeVisible();
  }

  async function signOutAndSignInAs(page: Page, address: string) {
    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.getByRole("button", { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await page.getByLabel("Email address").fill(address);
    await page.getByLabel("Password").fill(FIXTURE_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
  }

  test("invites a person, changes their role and records each change", async ({ page }) => {
    await openAs(page, "/admin");
    await invite(page);
    await expect(row(page, "Zanele Mokoena").getByText("Invited")).toBeVisible();

    await page.getByRole("button", { name: "Edit Zanele Mokoena" }).click();
    await dialog(page).getByLabel("Role").selectOption("Shift Supervisor");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(row(page, "Zanele Mokoena").getByText("Shift Supervisor")).toBeVisible();
    await expect(page.getByText(/Changed Zanele Mokoena: role to Shift Supervisor/)).toBeVisible();
    await expect(page.getByText(/Invited Zanele Mokoena as Maintenance Planner/)).toBeVisible();
  });

  test("an invited person signs in to their own start page and becomes active", async ({ page }) => {
    await openAs(page, "/admin");
    await invite(page, "Maintenance Planner");
    await signOutAndSignInAs(page, email);
    await expect(page).toHaveURL(/\/equipment/);
    await expect(page.getByRole("button", { name: /Account menu for Zanele Mokoena/ })).toBeVisible();
    // A planner can see people but not change them.
    await page.goto("/admin");
    await expect(page.getByRole("button", { name: "Invite person" })).toHaveCount(0);
    await expect(row(page, "Zanele Mokoena").getByText("Active")).toBeVisible();
  });

  test("turning access off stops sign-in and restoring it lets the person back in", async ({ page }) => {
    await openAs(page, "/admin");
    await page.getByRole("button", { name: "Turn off access for Sipho Nkosi" }).click();
    await dialog(page).getByRole("button", { name: "Turn off access" }).click();
    await expect(row(page, "Sipho Nkosi").getByText("Deactivated")).toBeVisible();

    await signOutAndSignInAs(page, "sipho.nkosi@riverside.example");
    await expect(page.getByText(/access to VESPER has been turned off/)).toBeVisible();

    await page.getByLabel("Email address").fill("john.dlamini@riverside.example");
    await page.getByLabel("Password").fill(FIXTURE_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("button", { name: /Account menu for John Dlamini/ })).toBeVisible();
    await page.goto("/admin");
    await page.getByRole("button", { name: "Restore access for Sipho Nkosi" }).click();
    await expect(row(page, "Sipho Nkosi").getByText("Active")).toBeVisible();
  });

  test("protects the account you are using and withdraws only pending invitations", async ({ page }) => {
    await openAs(page, "/admin");
    await expect(page.getByRole("button", { name: "Turn off access for John Dlamini" })).toHaveCount(0);
    await page.getByRole("button", { name: "Edit John Dlamini" }).click();
    await dialog(page).getByLabel("Role").selectOption("Shift Supervisor");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/cannot change your own role/)).toBeVisible();
    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await invite(page);
    await page.getByRole("button", { name: "Withdraw the invitation for Zanele Mokoena" }).click();
    await dialog(page).getByRole("button", { name: "Withdraw invitation" }).click();
    await expect(row(page, "Zanele Mokoena")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Withdraw the invitation for Sipho Nkosi" })).toHaveCount(0);
  });

  test("rejects a duplicate email address", async ({ page }) => {
    await openAs(page, "/admin");
    await page.getByRole("button", { name: "Invite person" }).click();
    await dialog(page).getByLabel("Full name").fill("Another Amina");
    await dialog(page).getByLabel("Work email address").fill("amina.patel@riverside.example");
    await dialog(page).getByLabel("Role").selectOption("Field Employee");
    await dialog(page).getByRole("button", { name: "Send invitation" }).click();
    await expect(page.getByText(/already has access/).first()).toBeVisible();
  });

  test("edits the site and company, and the site name follows through the app", async ({ page }) => {
    await openAs(page, "/admin");
    await page.getByRole("tab", { name: "Site" }).click();
    await page.getByRole("button", { name: "Edit site" }).click();
    await dialog(page).getByLabel("Site name").fill("Riverside North Pit");
    await dialog(page).getByLabel("Commodity").fill("Chrome");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: "Riverside North Pit", level: 2 })).toBeVisible();
    await expect(page.getByText("Chrome")).toBeVisible();
    await expect(page.getByRole("banner").getByText("Riverside North Pit").first()).toBeVisible();

    await page.getByRole("tab", { name: "Company" }).click();
    await page.getByRole("button", { name: "Edit company" }).click();
    await dialog(page).getByLabel("Contact email").fill("not-an-email");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(dialog(page).getByText(/valid email/)).toBeVisible();
    await dialog(page).getByLabel("Contact email").fill("ops@riverside.example");
    await dialog(page).getByLabel("Company name").fill("Riverside Resources Holdings");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: "Riverside Resources Holdings" })).toBeVisible();
    await expect(page.getByText("ops@riverside.example")).toBeVisible();
  });

  test("shows only the client's own plan and usage, never the other tiers", async ({ page }) => {
    await openAs(page, "/admin");
    await page.getByRole("tab", { name: "Plan and usage" }).click();
    await expect(page.getByRole("heading", { name: "Operations — Single Site" })).toBeVisible();
    await expect(page.getByText("What you are using")).toBeVisible();
    await expect(page.getByText(/speak to your HIMARK account manager/)).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.getByText(/Enterprise/)).toHaveCount(0);
  });

  test("lets supervisors see the organisation but not change it", async ({ page }) => {
    await openAs(page, "/admin", "Amina Patel");
    await expect(page.getByText(/Only the Mine Manager can change/)).toBeVisible();
    await expect(row(page, "Sipho Nkosi")).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite person" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(0);
  });
});
