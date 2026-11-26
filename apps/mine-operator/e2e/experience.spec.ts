/**
 * Browser test (Playwright, desktop Chrome). Loading and feedback under normal, slow and failed requests. A small script added to the
 * page delays or fails calls to the demo API, as a slow or broken network would; the app itself has no artificial delays.
 * Covers layout-matched skeletons, background refresh that keeps the page, error states with a working retry, busy buttons that
 * cannot submit twice, upload progress, workspace switching while slow, and reduced motion.
 */
import { expect, test, type Page } from "@playwright/test";
import { pick, signIn } from "./support";

/** Delays (ms) or fails (path fragment) demo API calls. Read on every call, so a test can change it at any moment. */
const network = `(() => {
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/_demo/api/")) {
      const fail = localStorage.getItem("e2e-fail");
      const method = (init && init.method) || (typeof input === "object" && "method" in input ? input.method : "GET");
      if (fail && url.includes(fail.split(" ").pop()) && (!fail.includes(" ") || fail.startsWith(method + " "))) {
        return new Response(JSON.stringify({ data: { code: "NETWORK", message: "The server did not respond." } }), { status: 503, headers: { "content-type": "application/json" } });
      }
      const latency = Number(localStorage.getItem("e2e-latency") || 0);
      if (latency) await new Promise((resolve) => setTimeout(resolve, latency));
    }
    return original(input, init);
  };
})();`;

const setNetwork = (page: Page, latency: number, fail: string | null = null) =>
  page.evaluate(([ms, path]) => {
    localStorage.setItem("e2e-latency", String(ms));
    if (path) localStorage.setItem("e2e-fail", path as string);
    else localStorage.removeItem("e2e-fail");
  }, [latency, fail] as const);

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "network behaviour is checked once, on desktop");
  await page.addInitScript(network);
});

test("a slow first load shows a skeleton shaped like the page, then the records", async ({ page }) => {
  await signIn(page);
  await setNetwork(page, 1500);
  await page.goto("/trade/agreements");
  await expect(page.locator(".skeleton-page--page")).toBeVisible();
  await expect(page.locator(".route-progress.is-active")).toBeAttached();
  await expect(page.getByRole("heading", { name: "Agreements", level: 1 })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".skeleton-page")).toHaveCount(0);
  await expect(page.locator(".route-progress.is-active")).toHaveCount(0);
});

test("a background refresh keeps the page on screen; a failed refresh does not blank it", async ({ page }) => {
  await signIn(page);
  await page.goto("/trade/agreements");
  await expect(page.getByRole("row", { name: /^AGR-0047/ })).toBeVisible();
  await setNetwork(page, 1200);
  await page.getByRole("navigation", { name: "Trade navigation" }).getByRole("link", { name: "Deliveries" }).click();
  await expect(page.getByRole("heading", { name: "Deliveries", level: 1 })).toBeVisible();
  // Back to agreements: the cached records show at once while they refresh behind the scenes.
  await page.getByRole("navigation", { name: "Trade navigation" }).getByRole("link", { name: "Agreements" }).click();
  await expect(page.getByRole("row", { name: /^AGR-0047/ })).toBeVisible({ timeout: 1000 });
  await expect(page.locator(".skeleton-page")).toHaveCount(0);

  await setNetwork(page, 0, "/trade");
  await page.getByRole("navigation", { name: "Trade navigation" }).getByRole("link", { name: "Deliveries" }).click();
  await page.getByRole("navigation", { name: "Trade navigation" }).getByRole("link", { name: "Agreements" }).click();
  await expect(page.getByRole("row", { name: /^AGR-0047/ })).toBeVisible();
  await expect(page.getByText("This view could not be loaded")).toHaveCount(0);
});

test("a failed first load explains itself and Retry recovers once the network is back", async ({ page }) => {
  await signIn(page);
  await setNetwork(page, 0, "/trade");
  await page.goto("/trade/approvals");
  await expect(page.getByRole("alert").filter({ hasText: "This view could not be loaded" })).toBeVisible();
  await setNetwork(page, 600);
  await page.getByRole("button", { name: "Retry" }).click();
  // While it tries again the error gives way to the loading skeleton, never to a blank page.
  await expect(page.getByRole("alert").filter({ hasText: "This view could not be loaded" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Approvals", level: 1 })).toBeVisible({ timeout: 10_000 });
});

test("a slow save shows a busy button that cannot submit twice; a failed save keeps the form and says so", async ({ page }) => {
  await signIn(page, "Zinhle Mahlangu");
  await page.goto("/trade/enquiries");
  await page.getByRole("button", { name: "New enquiry" }).click();
  const dialog = page.getByRole("dialog");
  await pick(dialog.getByLabel("Client"), "Bayside Metals");
  await dialog.getByLabel("Requested quantity (t)").fill("700");
  await dialog.getByLabel("Delivery window").fill("Sep 2025");

  // First the save fails: the dialog stays open with the details, and the person is told.
  await setNetwork(page, 0, "POST /trade/enquiries");
  await dialog.getByRole("button", { name: "Log enquiry" }).click();
  await expect(page.getByText("That did not work").first()).toBeVisible();
  await expect(dialog.getByLabel("Requested quantity (t)")).toHaveValue("700");

  // Then it is slow: the button is busy and disabled, so a second click does nothing.
  await setNetwork(page, 1500);
  await dialog.getByRole("button", { name: "Log enquiry" }).click();
  const busy = dialog.getByRole("button", { name: /Saving/ });
  await expect(busy).toBeDisabled();
  await expect(busy.locator(".busy-spinner")).toBeVisible();
  await busy.click({ force: true }).catch(() => undefined);
  await expect(page.getByText("Enquiry logged").first()).toBeVisible({ timeout: 10_000 });
  await setNetwork(page, 0);
  await page.getByLabel("Search enquiries, customers or commodities").fill("Sep 2025");
  await expect(page.getByRole("row", { name: /Bayside Metals/ })).toHaveCount(1);
});

test("an upload reads the file with real progress, refuses a renamed file and shows the save in progress", async ({ page }) => {
  await signIn(page, "Zinhle Mahlangu");
  await page.goto("/trade/documents");
  await page.getByRole("button", { name: "Upload document" }).click();
  const dialog = page.getByRole("dialog");
  const input = dialog.locator('input[type="file"]');
  await input.setInputFiles({ name: "not-really.pdf", mimeType: "application/pdf", buffer: Buffer.from("plain text, not a PDF") });
  await expect(dialog.getByText(/contents do not match its type/)).toBeVisible();
  await input.setInputFiles({ name: "Weighbridge-April.pdf", mimeType: "application/pdf", buffer: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(2_000_000, 32)]) });
  await expect(dialog.getByText(/Weighbridge-April\.pdf/)).toBeVisible();
  await dialog.getByLabel("Record reference").fill("AGR-0047");
  await setNetwork(page, 1500);
  await dialog.getByRole("button", { name: "Upload" }).click();
  await expect(dialog.getByText("Saving the document record…")).toBeVisible();
  await expect(page.getByText("Document uploaded").first()).toBeVisible({ timeout: 10_000 });
});

test("switching workspace while slow shows the Trade dashboard skeleton, then the Overview", async ({ page }) => {
  await signIn(page);
  await page.goto("/overview");
  await setNetwork(page, 1500);
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("group", { name: "Switch workspace" }).getByRole("button", { name: /^Trade/ }).click();
  await expect(page).toHaveURL(/\/trade\/overview$/);
  await expect(page.locator(".skeleton-page--dashboard")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), John/, level: 1 })).toBeVisible({ timeout: 10_000 });
});

test("reduced motion turns page and dialog animations off", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page);
  await page.goto("/trade/agreements");
  await expect(page.getByRole("heading", { name: "Agreements", level: 1 })).toBeVisible();
  const duration = await page.locator(".main-content > *").first().evaluate((element) => parseFloat(getComputedStyle(element).animationDuration));
  expect(duration).toBeLessThan(0.01);
});
