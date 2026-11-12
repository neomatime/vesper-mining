import { expect, type Locator, type Page } from "@playwright/test";
import { accounts, FIXTURE_PASSWORD } from "../src/lib/accounts";

export type Person = "John Dlamini" | "Amina Patel" | "Sipho Nkosi" | "Lebo Maseko" | "Naledi Khoza" | "Thabo Molefe";

function accountFor(name: Person) {
  const account = accounts.find((item) => item.name === name);
  if (!account) throw new Error(`No fixture account for ${name}`);
  return account;
}

async function submitCredentials(page: Page, name: Person) {
  await page.getByLabel("Email address").fill(accountFor(name).email);
  await page.getByLabel("Password").fill(FIXTURE_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Signs in through the real sign-in screen and waits for the app to load. */
export async function signIn(page: Page, name: Person = "John Dlamini") {
  await page.goto("/sign-in");
  await submitCredentials(page, name);
  await expect(page.getByRole("button", { name: new RegExp(`Account menu for ${name}`) })).toBeVisible();
}

/** Signs in on the sign-in screen you are already on, keeping its redirect target. */
export async function signInHere(page: Page, name: Person = "John Dlamini") {
  await submitCredentials(page, name);
  await expect(page.getByRole("button", { name: new RegExp(`Account menu for ${name}`) })).toBeVisible();
}

/** Opens a page as a signed-in person. */
export async function openAs(page: Page, path: string, name: Person = "John Dlamini") {
  await signIn(page, name);
  await page.goto(path);
  await expect(page.getByRole("button", { name: /Account menu/ })).toBeVisible();
}

/** Signs out and signs back in as someone else, returning to the page you were on. */
export async function actAs(page: Page, name: Person) {
  const here = new URL(page.url());
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto(`/sign-in?next=${encodeURIComponent(here.pathname + here.search)}`);
  await submitCredentials(page, name);
  await expect(page.getByRole("button", { name: new RegExp(`Account menu for ${name}`) })).toBeVisible();
}

/** Chooses an option in one of VESPER's dropdowns, the way a person would: open it, then click the option. */
export async function pick(control: Locator, option: string | { label: string } | { index: number }) {
  await control.click();
  const list = control.page().getByRole("listbox");
  await expect(list).toBeVisible();
  if (typeof option === "object" && "index" in option) await list.getByRole("option").nth(option.index).click();
  else await list.getByRole("option", { name: typeof option === "string" ? option : option.label, exact: true }).click();
  await expect(list).toHaveCount(0);
}

/** Sets the subscription through the presenter console. */
export async function setPlan(page: Page, plan: string) {
  await page.goto("/demo");
  await pick(page.getByLabel(/Subscription shown/), plan);
}
