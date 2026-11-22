/**
 * Browser test (Playwright, desktop Chrome and a phone). VESPER Intelligence on the Command Centre: prioritised insights linked to their
 * records, Ask VESPER answering from records, and the shift briefing, in both themes. Everything is generated from existing records.
 */
import { expect, test } from "@playwright/test";
import { openAs } from "./support";

for (const scheme of ["light", "dark"] as const) {
  test.describe(`VESPER Intelligence in the ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test("shows prioritised insights, each linked to its record, and a shift briefing that approves nothing", async ({ page }) => {
      await openAs(page, "/overview");
      const panel = page.getByRole("article", { name: /VESPER Intelligence/ });
      await expect(panel).toBeVisible();
      await expect(panel).toContainText("Generated from your records");
      await expect(panel).toContainText("Production at risk");
      await expect(panel).toContainText("up to 180 g of gold");
      await expect(panel).toContainText(/R.?180.?000/);
      await expect(panel.getByRole("link", { name: /Review impact/ })).toHaveAttribute("href", /\/exceptions\/issue-/);
      await expect(panel).toContainText("SHP-0047 is awaiting transport confirmation");
      await expect(panel.getByRole("link", { name: /Confirm transport/ })).toHaveAttribute("href", "/shipments/ship-47");
      const briefing = page.getByRole("article", { name: /Shift briefing/ });
      await expect(briefing).toContainText("Production: 156,200 t reported");
      await expect(briefing).toContainText("Reported, not verified");
      await expect(briefing).toContainText("nothing is approved here");
      await expect(briefing.getByRole("link", { name: /View full briefing/ })).toBeVisible();
    });

    test("Ask VESPER answers from records, links to them, and says plainly what it cannot answer", async ({ page }) => {
      await openAs(page, "/overview");
      const ask = page.getByLabel("Ask VESPER a question about your operations");
      await ask.fill("Which shipments are at risk?");
      await page.getByRole("button", { name: "Ask", exact: true }).click();
      const answer = page.getByRole("status").filter({ hasText: "SHP-0047" });
      await expect(answer).toContainText("waiting for transport confirmation");
      await expect(answer.getByRole("link", { name: "SHP-0047" })).toHaveAttribute("href", "/shipments/ship-47");

      await ask.fill("What is the estimated sales value affected by operational delays?");
      await page.getByRole("button", { name: "Ask", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "not a confirmed loss" })).toBeVisible();

      await ask.fill("Who will win the football this weekend?");
      await page.getByRole("button", { name: "Ask", exact: true }).click();
      await expect(page.getByText(/I can answer questions about/)).toBeVisible();
      await expect(page.getByRole("list", { name: "Questions you can ask" })).toBeVisible();
    });
  });
}
