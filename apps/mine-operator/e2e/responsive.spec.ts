import { expect, test } from "@playwright/test";
import { openAs } from "./support";

test.describe("phone layout", () => {
  test.skip(({ isMobile }) => !isMobile, "These checks run on the phone project.");

  test("no page scrolls sideways", async ({ page }) => {
    await openAs(page, "/overview", "John Dlamini");
    for (const route of ["/overview", "/exceptions", "/equipment", "/shifts", "/shifts?view=calendar", "/admin", "/profile", "/mobile/my-shift", "/mobile/schedule"]) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${route} scrolls sideways`).toBeLessThanOrEqual(0);
    }
  });

  test("keeps the profile picture fully inside the top bar", async ({ page }) => {
    await openAs(page, "/admin", "John Dlamini");
    const box = await page.locator(".profile-chip").boundingBox();
    const bar = await page.locator(".topbar").boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((bar?.x ?? 0) + (bar?.width ?? 0));
  });

  test("fades the edge of administration tabs that carry on past the screen", async ({ page }) => {
    await openAs(page, "/admin", "John Dlamini");
    const tabs = page.getByRole("tablist", { name: "Administration sections" });
    await expect(tabs).toHaveAttribute("data-fade-right", "");
    await tabs.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    await expect(tabs).toHaveAttribute("data-fade-left", "");
    await expect(tabs).not.toHaveAttribute("data-fade-right", "");
  });

  test("shows the mine photograph, the mark, the wordmark and the card on the sign-in page", async ({ page }) => {
    await page.goto("/sign-in");
    const image = await page.locator(".login").evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(image).toContain("sign-in-background");
    const mark = await page.locator(".login__mark").boundingBox();
    const wordmark = await page.locator(".login__wordmark").boundingBox();
    const card = await page.locator(".login__card").boundingBox();
    expect(mark && wordmark && card).toBeTruthy();
    // Mark, then wordmark, then card, top to bottom, none overlapping.
    expect((wordmark?.y ?? 0) - ((mark?.y ?? 0) + (mark?.height ?? 0))).toBeGreaterThanOrEqual(0);
    expect((card?.y ?? 0) - ((wordmark?.y ?? 0) + (wordmark?.height ?? 0))).toBeGreaterThan(24);
    await expect(page.getByRole("img", { name: "VESPER" })).toBeVisible();
  });

  test("gives touch controls a comfortable size", async ({ page }) => {
    await openAs(page, "/mobile/schedule", "Amina Patel");
    for (const name of ["Previous month", "Next month"]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const chip = await page.getByRole("button", { name: "Week", exact: true }).boundingBox();
    expect(chip?.height ?? 0).toBeGreaterThanOrEqual(40);
  });

  test("does not raise the keyboard on its own when sign-in opens", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByLabel("Email address")).toBeVisible();
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("INPUT");
  });

  test("keeps the whole sign-in form above where a phone keyboard sits", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email address").tap();
    const brand = page.locator(".login__brand");
    await expect.poll(async () => (await brand.boundingBox())?.height ?? 999).toBeLessThan(70);
    const height = page.viewportSize()?.height ?? 0;
    const keyboard = 340;
    for (const target of [page.getByLabel("Password"), page.getByRole("button", { name: "Sign in", exact: true })]) {
      const box = await target.boundingBox();
      expect((box?.y ?? 0) + (box?.height ?? 0), "sits above the keyboard").toBeLessThanOrEqual(height - keyboard);
    }
  });
});

test.describe("desktop sign-in", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop keeps the first field ready for typing.");

  test("puts the cursor in the email field", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByLabel("Email address")).toBeFocused();
  });

  test("floats the top bar clear of the screen edges", async ({ page }) => {
    await openAs(page, "/overview", "John Dlamini");
    const bar = await page.locator(".topbar").boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    expect(bar?.y ?? 0).toBeGreaterThanOrEqual(8);
    expect(bar?.x ?? 0).toBeGreaterThanOrEqual(8);
    expect((bar?.x ?? 0) + (bar?.width ?? 0)).toBeLessThanOrEqual(width - 8);
  });
});

test.describe("desktop top bar", () => {
  test.skip(({ isMobile }) => isMobile, "The wide layout runs on the desktop project.");

  test("floats clear of the screen edges and keeps the page below it", async ({ page }) => {
    await openAs(page, "/overview", "John Dlamini");
    const bar = await page.locator(".topbar").boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    expect(bar?.y ?? 0).toBeGreaterThanOrEqual(8);
    expect(bar?.x ?? 0).toBeGreaterThanOrEqual(12);
    expect((bar?.x ?? 0) + (bar?.width ?? 0)).toBeLessThanOrEqual(width - 12);
    const heading = await page.getByRole("heading", { level: 1 }).first().boundingBox();
    expect(heading?.y ?? 0).toBeGreaterThan((bar?.y ?? 0) + (bar?.height ?? 0));
  });
});
