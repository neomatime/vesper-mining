import { expect, test } from "@playwright/test";
import { openAs } from "./support";

test.describe("Overview as a decision screen", () => {
  test("leads with what needs the person now, then what comes next", async ({ page }) => {
    await openAs(page, "/overview", "John Dlamini");
    await expect(page.getByRole("heading", { name: "Needs you now" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Review recovery actions/ })).toBeVisible();

    const next = page.getByLabel("Also needs you");
    const cards = next.locator("article");
    await expect(cards).toHaveCount(2);
    for (let index = 0; index < 2; index += 1) {
      await expect(cards.nth(index).getByRole("heading", { level: 3 })).toBeVisible();
      await expect(cards.nth(index).getByRole("link")).toBeVisible();
    }
  });

  test("takes the person straight to the next thing from its own button", async ({ page }) => {
    await openAs(page, "/overview", "John Dlamini");
    const first = page.getByLabel("Also needs you").locator("article").first();
    const href = await first.getByRole("link").getAttribute("href");
    await first.getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test("keeps the evidence limits visible and shows each step once", async ({ page }) => {
    await openAs(page, "/overview", "John Dlamini");
    await expect(page.getByText("Opportunity not quantified")).toBeVisible();
    await expect(page.getByText("Safety authorisation")).toBeVisible();
    await expect(page.getByText("Verify spare-part availability")).toHaveCount(1);
    await expect(page.getByText(/1 complete · 1 in progress · 2 pending/)).toBeVisible();
  });
});

test.describe("status shapes", () => {
  test.skip(({ isMobile }) => isMobile, "Checked on the desktop table.");

  test("tells scheduled, in progress and closed shifts apart by shape, not only colour", async ({ page }) => {
    await openAs(page, "/shifts", "John Dlamini");
    await expect(page.locator('[data-family="active"]', { hasText: "In progress" }).first()).toBeVisible();
    await expect(page.locator('[data-family="waiting"]', { hasText: "Scheduled" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Closed", exact: true }).click();
    await expect(page.locator('[data-family="done"]', { hasText: "Closed" }).first()).toBeVisible();

    const shapes = await page.evaluate(() => {
      const dot = (family: string) => {
        const element = document.querySelector(`[data-family="${family}"] .status-badge__dot`);
        return element ? getComputedStyle(element).boxShadow + getComputedStyle(element).backgroundImage + getComputedStyle(element).backgroundColor : "";
      };
      return [dot("done"), dot("waiting")];
    });
    expect(shapes[0]).not.toBe(shapes[1]);
  });
});
