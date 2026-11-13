import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support";

const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number) as [number, number, number];
const luminance = ([r, g, b]: [number, number, number]) => {
  const f = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const background = (page: Page, selector: string) => page.locator(selector).first().evaluate((element) => getComputedStyle(element).backgroundColor);

for (const scheme of ["light", "dark"] as const) {
  test.describe(`top bar and sidebar in the ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test("are the same family of surface, so the interface changes as one", async ({ page, isMobile }) => {
      test.skip(isMobile, "The sidebar is a desktop layout.");
      await signIn(page, "John Dlamini");
      await page.goto("/overview");
      await expect(page.locator(".sidebar")).toBeVisible();
      const bar = rgb(await background(page, ".topbar"));
      const side = rgb(await background(page, ".sidebar"));
      // The two surfaces are the same colour to within a rounding step.
      for (let channel = 0; channel < 3; channel += 1) expect(Math.abs((bar[channel] ?? 0) - (side[channel] ?? 0))).toBeLessThanOrEqual(2);
      // And each follows the theme: light surfaces in light, dark surfaces in dark.
      if (scheme === "light") expect(luminance(bar)).toBeGreaterThan(0.8);
      else expect(luminance(bar)).toBeLessThan(0.05);
    });

    test("keep the top bar's text readable", async ({ page }) => {
      await signIn(page, "John Dlamini");
      await page.goto("/overview");
      for (const selector of [".topbar .wordmark", ".topbar .site-selector__copy strong", ".topbar .site-selector__copy small", ".topbar .profile-chip strong", ".topbar .profile-chip small"]) {
        const [fg, bg] = await page.locator(selector).first().evaluate((element) => {
          let node: Element | null = element;
          let surface = "rgb(255, 255, 255)";
          while (node) {
            const color = getComputedStyle(node).backgroundColor;
            if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
              surface = color;
              break;
            }
            node = node.parentElement;
          }
          return [getComputedStyle(element).color, surface];
        });
        expect(contrast(rgb(fg ?? ""), rgb(bg ?? "")), selector).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
}

test.describe("the top bar does not smudge the sidebar", () => {
  test("has a hairline edge and no heavy shadow", async ({ page }) => {
    await signIn(page, "John Dlamini");
    await page.goto("/overview");
    const style = await page.locator(".topbar").evaluate((element) => {
      const s = getComputedStyle(element);
      return { shadow: s.boxShadow, border: s.borderTopWidth };
    });
    expect(style.border).toBe("1px");
    // Every blur radius in the shadow is small: nothing like the 40px smear it used to cast.
    const blurs = [...style.shadow.matchAll(/(?:rgba?\([^)]*\)|#[0-9a-f]+)\s+(-?\d+)px\s+(-?\d+)px\s+(\d+)px/g)].map((match) => Number(match[3]));
    for (const blur of blurs) expect(blur).toBeLessThanOrEqual(6);
  });
});

test.describe("sidebar hover", () => {
  test("shows a clear tint and changes colour without moving", async ({ page, isMobile }) => {
    test.skip(isMobile, "Hover is a pointer interaction.");
    await signIn(page, "John Dlamini");
    await page.goto("/overview");
    const link = page.locator(".sidebar__nav a:not(.active)").first();
    const before = await link.evaluate((element) => ({ bg: getComputedStyle(element).backgroundColor, box: element.getBoundingClientRect().toJSON() }));
    await link.hover();
    await expect.poll(() => link.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(before.bg);
    const after = await link.evaluate((element) => ({ bg: getComputedStyle(element).backgroundColor, transform: getComputedStyle(element).transform, box: element.getBoundingClientRect().toJSON() }));
    // It does not move or scale: text stays on whole pixels and stays crisp.
    expect(after.transform).toBe("none");
    expect(Math.abs(after.box.x - before.box.x)).toBeLessThan(0.5);
    // And the tint stands out from the white sidebar behind it.
    const sidebar = rgb(await background(page, ".sidebar"));
    expect(contrast(rgb(after.bg), sidebar)).toBeGreaterThan(1.08);
  });

  test("works on the first items at the top of the sidebar", async ({ page, isMobile }) => {
    test.skip(isMobile, "Hover is a pointer interaction.");
    await signIn(page, "John Dlamini");
    await page.goto("/overview");
    for (const name of ["Operational Map", "Work & Exceptions"]) {
      const link = page.locator(".sidebar__nav a", { hasText: name });
      await link.hover();
      const hit = await link.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest("a") === element;
      });
      expect(hit, name).toBe(true);
    }
  });
});
