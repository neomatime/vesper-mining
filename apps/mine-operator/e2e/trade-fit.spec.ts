/**
 * Browser test (Playwright, desktop Chrome). Every Trade table fits inside its card at common desktop widths: nothing runs past the
 * card's edge. Also checks that stacked cards on a transport provider page keep a gap between them.
 */
import { expect, test } from "@playwright/test";
import { signIn } from "./support";

const pages = ["portfolio", "enquiries", "agreements", "deliveries", "logistics", "logistics?tab=agreements", "logistics?tab=requests", "settlements", "approvals", "documents", "linked-operations", "reports"];

for (const width of [1280, 1440, 1920]) {
  test(`trade tables fit their cards at ${width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "desktop widths only");
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 1000 });
    await signIn(page);
    const overflowing: string[] = [];
    for (const path of pages) {
      await page.goto(`/trade/${path}`);
      await expect(page.locator(".trade-register table").first()).toBeVisible();
      const over = await page.locator(".trade-register .table-wrap").evaluateAll((wraps) => wraps.filter((wrap) => wrap.scrollWidth > wrap.clientWidth + 1).length);
      if (over) overflowing.push(path);
    }
    expect(overflowing).toEqual([]);
  });
}

test("stacked cards on a provider page keep a gap", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "desktop only");
  await signIn(page);
  await page.goto("/trade/logistics/tr-001");
  const cards = page.locator(".task-page > .card");
  await expect(cards.nth(1)).toBeVisible();
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(second!.y - (first!.y + first!.height)).toBeGreaterThanOrEqual(12);
});
