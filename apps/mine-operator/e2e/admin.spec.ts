import { expect, test, type Page } from "@playwright/test";
import { FIXTURE_PASSWORD } from "../src/lib/accounts";
import { openAs } from "./support";

test.describe("administration", () => {
  test.skip(({ isMobile }) => isMobile, "Administration is exercised on the desktop layout.");

  const dialog = (page: Page) => page.getByRole("dialog");
  const row = (page: Page, name: string) => page.getByRole("row", { name: new RegExp(name) });
  const email = "zanele.mokoena@riverside.example";

  /** Adds an employee and returns the temporary password shown once. */
  async function addEmployee(page: Page, role = "Maintenance Planner") {
    await page.getByRole("button", { name: "Add employee" }).click();
    await dialog(page).getByLabel("Full name").fill("Zanele Mokoena");
    await dialog(page).getByLabel("Work email address").fill(email);
    await dialog(page).getByLabel("Phone number").fill("+27 82 555 0199");
    await dialog(page).getByLabel("Employee number").fill("RIV-0100");
    await dialog(page).getByLabel("Role").selectOption(role);
    await dialog(page).getByRole("button", { name: "Add employee" }).click();
    await expect(dialog(page).getByText("Zanele Mokoena has been added")).toBeVisible();
    const password = (await dialog(page).locator("code").innerText()).trim();
    await dialog(page).getByRole("button", { name: "Done" }).click();
    await expect(row(page, "Zanele Mokoena")).toBeVisible();
    return password;
  }

  async function signOut(page: Page) {
    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.getByRole("button", { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  }

  async function signInWith(page: Page, address: string, password: string) {
    await page.getByLabel("Email address").fill(address);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
  }

  test("keeps Administration in the profile menu, not the sidebar", async ({ page }) => {
    await openAs(page, "/overview");
    await expect(page.getByRole("complementary").getByRole("link", { name: "Administration" })).toHaveCount(0);
    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.getByRole("link", { name: /Administration/ }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Organisation", level: 1 })).toBeVisible();
  });

  test("adds an employee, who must choose their own password and lands on their start page", async ({ page }) => {
    await openAs(page, "/admin");
    const temporary = await addEmployee(page);
    await expect(row(page, "Zanele Mokoena").getByText("Awaiting first sign-in")).toBeVisible();

    await signOut(page);
    await signInWith(page, email, temporary);
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByLabel("Confirm new password").fill("short");
    await page.getByRole("button", { name: /Save and continue/ }).click();
    await expect(page.getByText(/at least 10 characters/i).first()).toBeVisible();
    await page.getByLabel("New password", { exact: true }).fill("Quarry-Face-2025");
    await page.getByLabel("Confirm new password").fill("Quarry-Face-2025");
    await page.getByRole("button", { name: /Save and continue/ }).click();
    await expect(page).toHaveURL(/\/equipment/);
    await expect(page.getByRole("button", { name: /Account menu for Zanele Mokoena/ })).toBeVisible();

    // A planner does not get Administration.
    await page.getByRole("button", { name: /Account menu/ }).click();
    await expect(page.getByRole("link", { name: /Administration/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Administration is for the Mine Manager/ })).toBeVisible();
  });

  test("opens an employee profile, edits it and shows the rights from their role", async ({ page }) => {
    await openAs(page, "/admin");
    await page.getByRole("link", { name: /Lebo Maseko/ }).click();
    await expect(page.getByRole("heading", { name: "Lebo Maseko", level: 1 })).toBeVisible();
    await expect(page.getByText("Rights from the Maintenance Planner role")).toBeVisible();
    await expect(page.getByText("Add, edit, retire and delete equipment")).toBeVisible();

    await page.getByRole("button", { name: "Edit details" }).click();
    await dialog(page).getByLabel("Phone number").fill("+27 82 000 1234");
    await dialog(page).getByLabel("Role").selectOption("Shift Supervisor");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Rights from the Shift Supervisor role")).toBeVisible();
    await expect(page.getByText("+27 82 000 1234")).toBeVisible();
    await expect(page.getByText(/Changed Lebo Maseko: phone number, role to Shift Supervisor/)).toBeVisible();
  });

  test("resets a password and shows the temporary one once", async ({ page }) => {
    await openAs(page, "/admin");
    await page.getByRole("link", { name: /Naledi Khoza/ }).click();
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(dialog(page).getByText("Password reset for Naledi Khoza")).toBeVisible();
    const temporary = (await dialog(page).locator("code").innerText()).trim();
    await dialog(page).getByRole("button", { name: "Done" }).click();
    await expect(page.getByText(/Temporary\. They choose their own at next sign-in/)).toBeVisible();

    await signOut(page);
    await signInWith(page, "naledi.khoza@riverside.example", FIXTURE_PASSWORD);
    await expect(page.getByText(/do not match/)).toBeVisible();
    await signInWith(page, "naledi.khoza@riverside.example", temporary);
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  });

  test("turns access off and restores it from the profile", async ({ page }) => {
    await openAs(page, "/admin");
    await page.getByRole("link", { name: /Sipho Nkosi/ }).click();
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: /Turn off access/ }).click();
    await dialog(page).getByRole("button", { name: "Turn off access" }).click();
    await expect(page.getByText("Deactivated").first()).toBeVisible();

    await signOut(page);
    await signInWith(page, "sipho.nkosi@riverside.example", FIXTURE_PASSWORD);
    await expect(page.getByText(/access to VESPER has been turned off/)).toBeVisible();

    await page.getByLabel("Email address").fill("john.dlamini@riverside.example");
    await page.getByLabel("Password").fill(FIXTURE_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("button", { name: /Account menu for John Dlamini/ })).toBeVisible();
    await page.goto("/admin");
    await page.getByRole("link", { name: /Sipho Nkosi/ }).click();
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: /Restore access/ }).click();
    await expect(page.getByText("Awaiting first sign-in")).toHaveCount(0);
    await expect(page.getByText("Active").first()).toBeVisible();
  });

  test("deletes an employee nobody refers to, and refuses to delete one with records", async ({ page }) => {
    await openAs(page, "/admin");
    await addEmployee(page);
    await page.getByRole("link", { name: /Zanele Mokoena/ }).click();
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: /Delete employee/ }).click();
    await dialog(page).getByRole("button", { name: "Delete employee" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(row(page, "Zanele Mokoena")).toHaveCount(0);

    await page.getByRole("link", { name: /Amina Patel/ }).click();
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: /Delete employee/ }).click();
    await dialog(page).getByRole("button", { name: "Delete employee" }).click();
    await expect(page.getByText(/Turn off access instead/).first()).toBeVisible();
  });

  test("protects the account in use", async ({ page }) => {
    await openAs(page, "/admin");
    await page.getByRole("link", { name: /John Dlamini/ }).click();
    await expect(page.getByRole("button", { name: "More actions" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reset password" })).toHaveCount(0);
    await page.getByRole("button", { name: "Edit details" }).click();
    await dialog(page).getByLabel("Role").selectOption("Shift Supervisor");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/cannot change your own role/)).toBeVisible();
  });

  test("rejects a duplicate email address and a duplicate employee number", async ({ page }) => {
    await openAs(page, "/admin");
    await page.getByRole("button", { name: "Add employee" }).click();
    await dialog(page).getByLabel("Full name").fill("Another Amina");
    await dialog(page).getByLabel("Work email address").fill("amina.patel@riverside.example");
    await dialog(page).getByLabel("Role").selectOption("Field Employee");
    await dialog(page).getByRole("button", { name: "Add employee" }).click();
    await expect(page.getByText(/already has access/).first()).toBeVisible();
    await dialog(page).getByLabel("Work email address").fill("another.amina@riverside.example");
    await dialog(page).getByLabel("Employee number").fill("RIV-0001");
    await dialog(page).getByRole("button", { name: "Add employee" }).click();
    await expect(page.getByText(/employee number/).first()).toBeVisible();
  });

  test("shows what each role can do on the User rights tab", async ({ page }) => {
    await openAs(page, "/admin");
    await page.getByRole("tab", { name: "User rights" }).click();
    await expect(page.getByRole("heading", { name: "What each role can do" })).toBeVisible();
    await expect(page.getByText(/Rights follow the role/)).toBeVisible();
    await expect(page.getByRole("img", { name: "Add, edit, retire and delete equipment, Maintenance Planner: Allowed" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Add, edit, retire and delete equipment, Field Employee: Not allowed" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Start, close and hand over a shift, Shift Supervisor: Own shifts only" })).toBeVisible();
  });

  test("searches and filters employees", async ({ page }) => {
    await openAs(page, "/admin");
    await page.getByLabel("Search employees").fill("planner");
    await expect(row(page, "Lebo Maseko")).toBeVisible();
    await expect(row(page, "Amina Patel")).toHaveCount(0);
    await page.getByLabel("Search employees").fill("");
    await page.getByRole("button", { name: "Deactivated" }).click();
    await expect(page.getByText("No employees match.")).toBeVisible();
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

  test("keeps Administration closed to supervisors", async ({ page }) => {
    await openAs(page, "/admin", "Amina Patel");
    await expect(page.getByRole("heading", { name: /Administration is for the Mine Manager/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add employee" })).toHaveCount(0);
  });
});
