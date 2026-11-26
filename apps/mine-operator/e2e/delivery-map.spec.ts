/**
 * Browser test (Playwright, desktop Chrome). The live delivery map on Trade > Deliveries: list and map views, vehicles colour-coded
 * by status, a delivery chosen in the table found on the map with all its vehicles, one vehicle's journey, a vehicle without
 * tracking, filters shared by the map and the table, live updates that can be paused, and full screen.
 */
import { expect, test } from "@playwright/test";
import { openAs, pick } from "./support";

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name !== "chromium", "the map is checked on desktop; the phone layout is covered by the responsive tests");
});

const map = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Delivery map" });

test("switches between list and map views, and the address keeps the view", async ({ page }) => {
  await openAs(page, "/trade/deliveries");
  await expect(map(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Map view" }).click();
  await expect(page).toHaveURL(/view=map/);
  await expect(map(page)).toBeVisible();
  await expect(map(page).locator(".dm-vehicle")).toHaveCount(9);
  await expect(map(page).getByRole("list", { name: "Legend" })).toContainText("Delayed (1)");
  await expect(map(page).getByRole("list", { name: "Legend" })).toContainText("No tracking (1)");
  await page.reload();
  await expect(map(page)).toBeVisible();
  await page.getByRole("button", { name: "List view" }).click();
  await expect(map(page)).toHaveCount(0);
});

test("finds a delivery from the table with all its vehicles, then one vehicle's journey", async ({ page }) => {
  await openAs(page, "/trade/deliveries?view=map");
  const row = page.getByRole("row", { name: /AGR-0045.*1,500 t.*In transit/ });
  await row.getByRole("button", { name: /on the map/ }).click();
  await expect(row).toHaveClass(/is-selected/);
  const panel = map(page).getByRole("region", { name: /vehicles$/ });
  await expect(panel).toContainText("Highveld Power Co-op");
  await expect(panel).toContainText("3 vehicles");
  await expect(panel).toContainText("Delayed");
  await panel.getByRole("button", { name: /MTS 102 GP/ }).click();

  const vehicle = map(page).getByRole("region", { name: /vehicle MTS 102 GP/ });
  await expect(vehicle).toContainText("Coal");
  await expect(vehicle).toContainText("34 t · 1 of 3");
  await expect(vehicle).toContainText("Metsi Logistics");
  await expect(vehicle).toContainText(/Stopped/);
  await expect(vehicle).toContainText(/Live/);
  await expect(vehicle.getByRole("link", { name: "View delivery details" })).toHaveAttribute("href", "/trade/deliveries/ag-45-apr-2");

  // A truck without a tracking unit is shown, marked, at an estimated position.
  await vehicle.getByRole("button", { name: "BRV 556 GP" }).click();
  const untracked = map(page).getByRole("region", { name: /vehicle BRV 556 GP/ });
  await expect(untracked).toContainText("Tracking unavailable");
  await expect(untracked).toContainText(/sends no tracking data/);
  await untracked.getByRole("button", { name: "Close" }).click();
  await expect(map(page).getByRole("region", { name: /vehicle BRV 556 GP/ })).toHaveCount(0);
  await expect(page).toHaveURL(/\/trade\/deliveries\?view=map$/);
});

test("filters the map and the table together, and clears them", async ({ page }) => {
  await openAs(page, "/trade/deliveries?view=map");
  const filters = map(page).getByRole("complementary", { name: "Map filters" });
  await filters.getByText("Delayed", { exact: true }).click();
  await filters.getByRole("button", { name: "Apply" }).click();
  await expect(map(page).locator(".dm-vehicle")).toHaveCount(1);
  await expect(page.getByRole("row", { name: /AGR-0045.*1,500 t/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /AGR-0041/ })).toHaveCount(0);

  await filters.getByRole("button", { name: "Clear all" }).click();
  await expect(map(page).locator(".dm-vehicle")).toHaveCount(9);
  await pick(filters.getByLabel("Logistics provider"), "ABC Logistics");
  await filters.getByRole("button", { name: "Apply" }).click();
  await expect(map(page).locator(".dm-vehicle")).toHaveCount(3);
  await expect(page.getByRole("row", { name: /AGR-0041.*1,800 t/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /AGR-0046.*In transit/ })).toHaveCount(0);
});

test("pauses live updates, goes full screen and back", async ({ page }) => {
  await openAs(page, "/trade/deliveries?view=map");
  await map(page).getByRole("button", { name: "Live tracking" }).click();
  await expect(map(page).getByRole("button", { name: "Tracking paused" })).toHaveAttribute("aria-pressed", "false");
  await map(page).getByRole("button", { name: "Full screen" }).click();
  await expect(map(page)).toHaveClass(/is-expanded/);
  await page.keyboard.press("Escape");
  await expect(map(page)).not.toHaveClass(/is-expanded/);
  await map(page).getByRole("button", { name: "Zoom in" }).click();
  await map(page).getByRole("button", { name: "Recentre the map" }).click();
});
