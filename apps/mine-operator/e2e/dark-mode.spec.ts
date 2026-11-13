import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support";

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

async function chooseAppearance(page: Page, name: "Light" | "Dark" | "Device") {
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("group", { name: "Appearance" }).getByRole("button", { name }).click();
}

/** Contrast of an element's text against the surface behind it, as a person would see it. */
async function contrastOf(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((element) => {
    const parse = (value: string) => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      const parts = (match?.[1] ?? "0,0,0").split(/[ ,/]+/).map(Number);
      return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] === undefined ? 1 : parts[3] };
    };
    const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    let background = { r: 255, g: 255, b: 255, a: 1 };
    const layers = [];
    for (let node: Element | null = element; node; node = node.parentElement) {
      const color = parse(getComputedStyle(node).backgroundColor);
      if (color.a > 0) {
        layers.push(color);
        if (color.a >= 0.99) break;
      }
    }
    for (const layer of layers.reverse()) {
      background = { r: layer.r * layer.a + background.r * (1 - layer.a), g: layer.g * layer.a + background.g * (1 - layer.a), b: layer.b * layer.a + background.b * (1 - layer.a), a: 1 };
    }
    const text = parse(getComputedStyle(element).color);
    const [a, b] = [luminance(text), luminance(background)];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

test.describe("on a device set to dark", () => {
  test.use({ colorScheme: "dark" });

  test("shows the dark theme from the first paint, before and after signing in", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    expect(await theme(page)).toBe("dark");
    await signIn(page, "John Dlamini");
    await page.goto("/overview", { waitUntil: "domcontentloaded" });
    expect(await theme(page)).toBe("dark");
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toMatch(/^rgb\((\d+), (\d+), (\d+)\)$/);
    const [r = 255] = background.match(/\d+/g)?.map(Number) ?? [];
    expect(r).toBeLessThan(40);
  });

  test("keeps text readable on the main surfaces", async ({ page }) => {
    await signIn(page, "John Dlamini");
    await page.goto("/overview");
    await expect(page.getByRole("heading", { name: "Needs you now" })).toBeVisible();
    for (const selector of ["h1", ".dashboard-greeting p", ".sidebar__nav a:not(.active)", ".sidebar__group > p", ".attention-card p", ".metric-card small"]) {
      expect(await contrastOf(page, selector), selector).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("Light overrides the device, and Device follows it again", async ({ page }) => {
    await signIn(page, "John Dlamini");
    expect(await theme(page)).toBe("dark");
    await chooseAppearance(page, "Light");
    expect(await theme(page)).toBe("light");
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await theme(page)).toBe("light");
    await chooseAppearance(page, "Device");
    expect(await theme(page)).toBe("dark");
  });
});

test.describe("on a device set to light", () => {
  test.use({ colorScheme: "light" });

  test("shows the light theme, and Dark is remembered across reloads", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    expect(await theme(page)).toBe("light");
    await signIn(page, "John Dlamini");
    await chooseAppearance(page, "Dark");
    expect(await theme(page)).toBe("dark");
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await theme(page)).toBe("dark");
    await page.getByRole("button", { name: /Account menu/ }).click();
    await expect(page.getByRole("group", { name: "Appearance" }).getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
  });

  test("follows the device live while Device is chosen", async ({ page }) => {
    await signIn(page, "John Dlamini");
    await chooseAppearance(page, "Device");
    expect(await theme(page)).toBe("light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => theme(page)).toBe("dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => theme(page)).toBe("light");
  });

  test("the switch is on the phone too, and the choice carries to other screens", async ({ page }) => {
    await signIn(page, "Amina Patel");
    await chooseAppearance(page, "Dark");
    for (const route of ["/overview", "/shifts", "/mobile/schedule"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(await theme(page), route).toBe("dark");
    }
  });
});
