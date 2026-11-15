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
