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
    const width = page.viewportSize()?.width ?? 0;
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
  });

  test("fades the edge of administration tabs that carry on past the screen", async ({ page }) => {
    await openAs(page, "/admin", "John Dlamini");
    const tabs = page.getByRole("tablist", { name: "Administration sections" });
    await expect(tabs).toHaveAttribute("data-fade-right", "");
    await tabs.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    await expect(tabs).toHaveAttribute("data-fade-left", "");
    await expect(tabs).not.toHaveAttribute("data-fade-right", "");
  });

  test("shows the photograph on the sign-in page", async ({ page }) => {
    await page.goto("/sign-in");
    const image = await page.locator(".signin__brand").evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(image).toContain("sign-in-sunset-plant");
    const wordmark = await page.locator(".signin__mark").boundingBox();
    const statement = await page.locator(".signin__statement").boundingBox();
    expect((statement?.y ?? 0) - ((wordmark?.y ?? 0) + (wordmark?.height ?? 0))).toBeGreaterThan(24);
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
});
