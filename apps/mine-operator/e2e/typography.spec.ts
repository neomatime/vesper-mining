import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support";

/** Every rendered text element's family and weight, so one stray heavy weight or other typeface shows up. */
async function typeAudit(page: Page) {
  return page.evaluate(() => {
    const weights = new Set<number>();
    const families = new Set<string>();
    const strays: string[] = [];
    for (const element of document.body.querySelectorAll("*")) {
      const own = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent?.trim());
      if (!own) continue;
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const weight = parseInt(style.fontWeight, 10);
      weights.add(weight);
      families.add(style.fontFamily.split(",")[0]?.trim().replace(/"/g, "") ?? "");
      if (weight > 500 || weight < 300) strays.push(`${element.tagName.toLowerCase()}.${String(element.className).split(" ")[0]} = ${weight}`);
    }
    return { weights: [...weights].sort(), families: [...families], strays: strays.slice(0, 6) };
  });
}

test.describe("typography", () => {
  test("loads Inter from the product's own domain, and from nowhere else", async ({ page }) => {
    const fontRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font" || /\.(woff2?|ttf|otf)(\?|$)/.test(request.url())) fontRequests.push(request.url());
    });
    await page.goto("/sign-in");
    await expect.poll(() => page.evaluate(() => document.fonts.check('14px "Inter"'))).toBe(true);
    expect(fontRequests.length).toBeGreaterThan(0);
    for (const url of fontRequests) expect(new URL(url).host, url).toBe(new URL(page.url()).host);
    expect(fontRequests.some((url) => /Inter/.test(url))).toBe(true);
    expect(fontRequests.some((url) => /Jakarta/i.test(url))).toBe(false);
  });

  test("sets every screen in one family, with weights between 300 and 500", async ({ page }) => {
    await page.goto("/sign-in");
    const signInAudit = await typeAudit(page);
    expect(signInAudit.strays, "sign in").toEqual([]);
    expect(signInAudit.families, "sign in").toEqual(["Inter"]);

    await signIn(page, "John Dlamini");
    for (const route of ["/overview", "/shifts", "/shifts?view=calendar", "/equipment", "/equipment/eq-crusher-c02", "/exceptions", "/reports/production-vs-plan", "/admin", "/profile"]) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      const audit = await typeAudit(page);
      expect(audit.strays, route).toEqual([]);
      expect(audit.families, route).toEqual(["Inter"]);
    }
  });

  test("keeps the hierarchy: the page title is larger and no lighter than its body text", async ({ page }) => {
    await signIn(page, "John Dlamini");
    await page.goto("/shifts");
    await expect(page.locator(".page-header h1")).toBeVisible();
    const sizes = await page.evaluate(() => {
      const pick = (selector: string) => {
        const style = getComputedStyle(document.querySelector(selector) as Element);
        return { size: parseFloat(style.fontSize), weight: parseInt(style.fontWeight, 10) };
      };
      return { title: pick(".page-header h1"), body: pick(".page-header p"), label: pick(".eyebrow") };
    });
    expect(sizes.title.size).toBeGreaterThan(sizes.body.size * 1.7);
    expect(sizes.title.weight).toBeLessThanOrEqual(500);
    expect(sizes.label.size).toBeLessThan(sizes.body.size);
  });

  test("lines figures up with shared digit widths", async ({ page }) => {
    await signIn(page, "John Dlamini");
    await page.goto("/overview");
    const variant = await page.locator(".metric-card strong").first().evaluate((element) => getComputedStyle(element).fontVariantNumeric);
    expect(variant).toContain("tabular-nums");
  });
});
