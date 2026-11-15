/**
 * Browser test (Playwright, desktop Chrome and a phone). The app can be installed: every page links the manifest, and the
 * manifest and its icons are served. Runs against a production build; see playwright.config.ts and scripts/run-e2e.mjs.
 */
import { expect, test } from "@playwright/test";

test.describe("install as an app", () => {
  test("links a manifest from the entry page and serves it with its icons", async ({ page, request }) => {
    await page.goto("/");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBe("/manifest.webmanifest");

    const response = await request.get(href!);
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    for (const icon of manifest.icons) {
      const file = await request.get(icon.src);
      expect(file.ok(), icon.src).toBe(true);
      expect(file.headers()["content-type"]).toContain("image/png");
    }
  });

  test("sets the browser's theme colour", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", "#ffffff");
  });
});

test.describe("install button", () => {
  /** Chrome sends this event itself on a real site; the test sends the same shape so the button can be seen without a real install. */
  const announceInstallable = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
      (window as unknown as { __installPrompts: number }).__installPrompts = 0;
      event.prompt = async () => { (window as unknown as { __installPrompts: number }).__installPrompts += 1; };
      event.userChoice = Promise.resolve({ outcome: "accepted" });
      window.dispatchEvent(event);
    });

  test("is in the account menu only when the browser can install the app, and starts the browser's install", async ({ page }) => {
    const { openAs } = await import("./support");
    await openAs(page, "/overview");
    await page.getByRole("button", { name: /Account menu for/ }).click();
    await expect(page.getByRole("button", { name: /Install app/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await announceInstallable(page);
    await page.getByRole("button", { name: /Account menu for/ }).click();
    await page.getByRole("button", { name: /Install app/ }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __installPrompts: number }).__installPrompts)).toBe(1);

    // The browser's event is single use, so the button goes until the browser offers again.
    await page.getByRole("button", { name: /Account menu for/ }).click();
    await expect(page.getByRole("button", { name: /Install app/ })).toHaveCount(0);
  });
});
