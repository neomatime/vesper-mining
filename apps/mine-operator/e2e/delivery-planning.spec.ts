/**
 * Browser test (Playwright, desktop Chrome). Planning a delivery on its own page: exact collection and delivery points found by
 * search, saved sites or typed coordinates, the route worked out between them, the load, transport and documents; clear errors
 * when something is missing; the plan shown on the delivery page and changed later. Runs without a Google Maps key, on VESPER's
 * own place list and route estimates.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { openAs } from "./support";

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name !== "chromium", "the planning page is checked on desktop; the phone layout is covered by the responsive tests");
});

async function choose(page: Page, control: Locator, option: RegExp) {
  await control.click();
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  await list.getByRole("option", { name: option }).first().click();
  await expect(list).toHaveCount(0);
}

const section = (page: Page, name: string) => page.getByRole("region", { name });

test("plans a delivery with exact points, a route and full details", async ({ page }) => {
  await openAs(page, "/trade/deliveries");
  await page.getByRole("link", { name: "Plan delivery" }).click();
  await expect(page).toHaveURL(/\/trade\/deliveries\/new$/);
  await expect(page.getByRole("heading", { name: "Plan a delivery" })).toBeVisible();

  // Nothing chosen yet: one summary lists what is missing, each linked to its section.
  await page.getByRole("button", { name: "Plan delivery" }).click();
  const summary = page.getByRole("alert").filter({ hasText: /need attention/ });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("Choose an active agreement.");
  await expect(summary).toContainText("Set the delivery point.");

  const agreement = section(page, "Agreement and quantity");
  await choose(page, agreement.getByRole("combobox", { name: /^Agreement/ }), /^AGR-0047/);
  await choose(page, agreement.getByRole("combobox", { name: /^Commitment/ }), /May 2025/);
  await agreement.getByRole("textbox", { name: /^Planned quantity/ }).fill("500");

  // The collection point starts at the saved loading bay.
  const collection = section(page, "Collection point");
  await expect(collection.getByLabel("Collection point name")).toHaveValue("Riverside Mine loading bay");

  // The delivery point by search: saved customer sites come first.
  const delivery = section(page, "Delivery point");
  await delivery.getByRole("combobox", { name: /Search for the delivery point/ }).fill("Middelburg");
  await delivery.getByRole("option", { name: /Horizon Metals, Middelburg/ }).first().click();
  await expect(delivery.getByLabel("Delivery point name")).toHaveValue("Horizon Metals, Middelburg");

  // The route is worked out at once: distance and time on the road network.
  const route = page.getByRole("complementary", { name: "Route summary" });
  await expect(route).toContainText("VESPER road network");
  await expect(route.getByText(/^\d+ km$/)).toBeVisible();
  await expect(route).toContainText(/\d h \d{2} min/);

  // Or exact coordinates for the precise offloading gate: the road route now ends there.
  await delivery.getByRole("button", { name: "Coordinates" }).click();
  await delivery.getByLabel("Delivery point coordinates").fill("-25.7612, 29.4795");
  await delivery.getByRole("button", { name: "Use coordinates" }).click();
  await expect(delivery).toContainText("-25.76120, 29.47950");
  await expect(delivery).toContainText("Entered coordinates");
  await delivery.getByLabel("Delivery point name").fill("Horizon Metals gate 3");
  await expect(route).toContainText("VESPER road network");
  await expect(route).toContainText("-25.76120, 29.47950");

  await delivery.getByLabel("Site contact").fill("Thabo Mokoena");
  await delivery.getByLabel("Contact phone").fill("+27 82 555 1000");
  await delivery.getByLabel("Site safety requirements").fill("Hard hat, boots and vest. Induction on first visit.");

  const load = section(page, "Load");
  await expect(load.getByLabel("Number of truckloads")).toHaveValue("15");
  await load.getByLabel("Number of truckloads").fill("10");
  await expect(load).toContainText("short of the plan");
  await load.getByLabel("Number of truckloads").fill("15");
  await expect(load).toContainText("Covers the 500 t planned");

  const transport = section(page, "Transport");
  await transport.getByRole("button", { name: "Add vehicle" }).click();
  await transport.getByLabel("Registration").fill("hxt 482 mp");
  await transport.getByLabel("Driver", { exact: true }).fill("Sipho Ndlovu");

  await page.getByRole("button", { name: "Plan delivery" }).click();
  await expect(page).toHaveURL(/\/trade\/deliveries\/del-/);
  const card = page.getByRole("article", { name: "Route and locations" });
  await expect(card).toContainText("Horizon Metals gate 3");
  await expect(card).toContainText("Riverside Mine loading bay");
  await expect(card).toContainText("-25.76120, 29.47950");
  await expect(card).toContainText("15 × 34 t");
  await expect(card).toContainText("HXT 482 MP");

  // The plan changes until the load leaves.
  await page.getByRole("link", { name: "Edit plan" }).first().click();
  await expect(page.getByRole("heading", { name: /Edit plan for DEL-/ })).toBeVisible();
  await section(page, "Delivery point").getByLabel("Receiving hours from").fill("06:00");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/trade\/deliveries\/del-[^/]+$/);
  await expect(page.getByRole("article", { name: "Route and locations" })).toContainText("06:00–17:00");
});

test("opens the planning page from an agreement, and keeps a delivery on the road fixed", async ({ page }) => {
  await openAs(page, "/trade/deliveries?plan=ag-47");
  await expect(page).toHaveURL(/\/trade\/deliveries\/new\?agreement=ag-47/);
  await expect(section(page, "Agreement and quantity").getByLabel("Agreement")).toContainText("AGR-0047");

  await page.goto("/trade/deliveries/ag-41-q2-1");
  const card = page.getByRole("article", { name: "Route and locations" });
  await expect(card).toContainText("Durban Bulk Terminal");
  await expect(card).toContainText("VESPER road network");
  await expect(page.getByRole("link", { name: "Edit plan" })).toHaveCount(0);
});
