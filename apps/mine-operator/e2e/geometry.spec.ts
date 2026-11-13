import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support";

/** Elements (and their ::before / ::after) with corners rounded by more than the largest step of the radius scale (12px) that are not a small dot, node, avatar or ring. */
async function roundedCorners(page: Page) {
  return page.evaluate(() => {
    const offenders: string[] = [];
    const check = (element: Element, pseudo: string | null) => {
      const style = getComputedStyle(element, pseudo);
      if (pseudo && (style.content === "none" || style.content === "normal")) return;
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || style.display === "none" || style.visibility === "hidden") return;
      const size = Math.min(box.width, box.height);
      // A percentage radius is a share of the box, so 50% on a square is a circle.
      const corner = (key: "borderTopLeftRadius") => (style[key].endsWith("%") ? (parseFloat(style[key]) / 100) * size : parseFloat(style[key]) || 0);
      const radius = Math.max(...(["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"] as const).map(corner));
      if (radius <= 12.5) return;
      const circle = radius >= size / 2 - 0.5;
      const name = (typeof (element as HTMLElement).className === "string" && (element as HTMLElement).className.split(" ")[0]) || element.tagName.toLowerCase();
      // Round is allowed for small dots, numbered progress nodes and the progress ring. Nothing else.
      const decorative = name === "brand-loader__halo" || (pseudo === "::after" && name === "signin__brand");
      if (circle && (size <= 32 || name === "progress-orbit" || decorative)) return;
      offenders.push(`${name}${pseudo ?? ""} r=${Math.round(radius)} ${Math.round(box.width)}x${Math.round(box.height)}`);
    };
    for (const element of document.body.querySelectorAll("*")) {
      if (element.closest(".leaflet-container, svg")) continue;
      check(element, null);
      check(element, "::before");
      check(element, "::after");
    }
    return [...new Set(offenders)].slice(0, 8);
  });
}

test.describe("soft geometry", () => {
  test("keeps every screen within the soft radius scale, apart from dots, nodes and rings", async ({ page }) => {
    await page.goto("/sign-in");
    expect(await roundedCorners(page), "sign in").toEqual([]);

    await signIn(page, "John Dlamini");
    for (const route of ["/overview", "/exceptions", "/exceptions/issue-riv-001", "/equipment", "/equipment/eq-crusher-c02", "/resources", "/shifts", "/shifts?view=calendar", "/reports", "/admin", "/profile", "/mobile/my-shift", "/mobile/notifications"]) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      expect(await roundedCorners(page), route).toEqual([]);
    }
  });

  test("keeps menus, dialogs, dropdowns and search within the scale too", async ({ page, isMobile }) => {
    test.skip(isMobile, "Opened from the desktop layout.");
    await signIn(page, "John Dlamini");
    await page.goto("/shifts");
    await page.getByRole("button", { name: "Create shift" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await roundedCorners(page), "dialog").toEqual([]);
    await page.getByRole("dialog").getByLabel("Supervisor").click();
    await expect(page.getByRole("listbox")).toBeVisible();
    expect(await roundedCorners(page), "dropdown").toEqual([]);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await page.goto("/overview");
    await page.getByRole("button", { name: /Account menu/ }).click();
    await expect(page.getByRole("group", { name: "Appearance" })).toBeVisible();
    expect(await roundedCorners(page), "account menu").toEqual([]);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await roundedCorners(page), "search").toEqual([]);
  });

  test("softly rounds the active navigation item and its badge", async ({ page, isMobile }) => {
    test.skip(isMobile, "The sidebar is a desktop layout.");
    await signIn(page, "John Dlamini");
    await page.goto("/overview");
    const radius = await page.locator(".sidebar__nav a.active").evaluate((element) => parseFloat(getComputedStyle(element).borderTopLeftRadius));
    expect(radius).toBeGreaterThanOrEqual(4);
    expect(radius).toBeLessThanOrEqual(12);
    const badge = await page.locator(".sidebar__nav em").first().evaluate((element) => parseFloat(getComputedStyle(element).borderTopLeftRadius));
    expect(badge).toBeGreaterThanOrEqual(4);
    expect(badge).toBeLessThanOrEqual(12);
  });
});
