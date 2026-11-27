/**
 * Helpers for the VESPER Mobile browser tests: signing in as a named demo person through the real sign-in screen.
 */
import { expect, type Page } from "@playwright/test";
import { accounts, FIXTURE_PASSWORD } from "../../../packages/core/src/lib/accounts";

export type Person = "John Dlamini" | "Amina Patel" | "Sipho Nkosi" | "Lebo Maseko" | "Naledi Khoza" | "Thabo Molefe" | "Zinhle Mahlangu";

/** Signs in on the sign-in screen and waits for VESPER Mobile to load. */
export async function signIn(page: Page, name: Person = "Thabo Molefe") {
  const account = accounts.find((item) => item.name === name);
  if (!account) throw new Error(`No fixture account for ${name}`);
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password").fill(FIXTURE_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Account menu for ${name}`) })).toBeVisible();
}

/** Opens a page as a signed-in person. */
export async function openAs(page: Page, path: string, name: Person = "Thabo Molefe") {
  await signIn(page, name);
  await page.goto(path);
  await expect(page.getByRole("button", { name: /Account menu/ })).toBeVisible();
}
