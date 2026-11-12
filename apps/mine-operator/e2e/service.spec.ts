import { expect, test, type Page } from "@playwright/test";
import { openAs, pick } from "./support";

test.describe("service providers and requests", () => {
  test.skip(({ isMobile }) => isMobile, "Service requests are exercised on the desktop layout.");

  const dialog = (page: Page) => page.getByRole("dialog");
  const row = (page: Page, name: string) => page.getByRole("row", { name: new RegExp(name) });
  const invite = (page: Page, name: string) => page.getByRole("listitem").filter({ hasText: name }).filter({ has: page.locator(".invite__head") });

  /** Opens a provider's private reply link in its own page, like a provider would, and runs the reply. */
  async function replyAs(page: Page, name: string, reply: (provider: Page) => Promise<void>) {
    const link = await page.getByLabel(`Reply link for ${name}`).inputValue();
    const provider = await page.context().newPage();
    await provider.goto(link);
    await expect(provider.getByRole("heading", { name: /500 hour inspection|Replace feed chute liner/ })).toBeVisible();
    await reply(provider);
    await provider.close();
    await page.reload();
  }

  async function openProviders(page: Page) {
    await openAs(page, "/admin");
    await page.getByRole("tab", { name: "Service providers" }).click();
    await expect(page.getByRole("heading", { name: "Service providers", level: 2 })).toBeVisible();
  }

  test("adds, edits, deactivates and deletes a service provider", async ({ page }) => {
    await openProviders(page);
    await expect(row(page, "OreTech Services")).toBeVisible();
    await page.getByRole("button", { name: "Add service provider" }).click();
    await dialog(page).getByLabel("Company name").fill("Delta Mining Services");
    await dialog(page).getByLabel("Contact person").fill("Sam Dube");
    await dialog(page).getByLabel("Email address").fill("sam@delta.example");
    await dialog(page).getByRole("button", { name: "Add provider" }).click();
    await expect(dialog(page).getByText(/at least one kind of equipment/)).toBeVisible();
    await dialog(page).getByRole("checkbox", { name: "Pump" }).check();
    await dialog(page).getByRole("checkbox", { name: "Crusher" }).check();
    await dialog(page).getByRole("button", { name: "Add provider" }).click();
    await expect(row(page, "Delta Mining Services")).toBeVisible();

    await page.getByRole("button", { name: "Edit Delta Mining Services" }).click();
    await dialog(page).getByLabel("Phone").fill("+27 11 555 0100");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("+27 11 555 0100")).toBeVisible();

    await page.getByRole("button", { name: "Deactivate Delta Mining Services" }).click();
    await dialog(page).getByRole("button", { name: "Deactivate" }).click();
    await expect(row(page, "Delta Mining Services").getByText("Deactivated")).toBeVisible();
    await page.getByRole("button", { name: "Reactivate Delta Mining Services" }).click();
    await expect(row(page, "Delta Mining Services").getByText(/Approved/)).toBeVisible();

    await page.getByRole("button", { name: "Delete Delta Mining Services" }).click();
    await dialog(page).getByRole("button", { name: "Delete provider" }).click();
    await expect(row(page, "Delta Mining Services")).toHaveCount(0);
  });

  test("rejects a duplicate provider name", async ({ page }) => {
    await openProviders(page);
    await page.getByRole("button", { name: "Add service provider" }).click();
    await dialog(page).getByLabel("Company name").fill("OreTech Services");
    await dialog(page).getByRole("checkbox", { name: "Crusher" }).check();
    await dialog(page).getByRole("button", { name: "Add provider" }).click();
    await expect(page.getByText(/already on the list/).first()).toBeVisible();
  });

  test("keeps provider management to the Mine Manager", async ({ page }) => {
    await openAs(page, "/admin", "Lebo Maseko");
    await expect(page.getByRole("heading", { name: /Administration is for the Mine Manager/ })).toBeVisible();
  });

  test("offers only approved providers that service the equipment", async ({ page }) => {
    await openAs(page, "/equipment/eq-crusher-c02/service/new", "Lebo Maseko");
    await expect(page.getByRole("heading", { name: "Request service", level: 1 })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /OreTech Services/ })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Karoo Crusher & Screen/ })).toBeVisible();
    // Expired approval, deactivated, and a provider that does not service crushers.
    await expect(page.getByRole("checkbox", { name: /Ridge Hydraulics/ })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: /Highveld Drilling Support/ })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: /Northgate Fleet Services/ })).toHaveCount(0);
    await expect(page.getByText(/Only providers already approved for this mine are shown/)).toBeVisible();
  });

  test("requests quotes, compares them, chooses a provider, books and completes the work", async ({ page }) => {
    await openAs(page, "/equipment/eq-crusher-c02", "Lebo Maseko");
    await page.getByRole("link", { name: /Request service/ }).first().click();
    await page.getByLabel("Work required").fill("500 hour inspection");
    await pick(page.getByLabel("Urgency"), "Urgent");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText(/at least one service provider/)).toBeVisible();
    await page.getByRole("checkbox", { name: /OreTech Services/ }).check();
    await page.getByRole("checkbox", { name: /Karoo Crusher & Screen/ }).check();
    await page.getByRole("button", { name: "Send request" }).click();

    await expect(page.getByRole("heading", { name: "500 hour inspection", level: 1 })).toBeVisible();
    await expect(page.getByText("Awaiting quotes").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose this provider" })).toHaveCount(0);

    // The mine cannot enter, edit or decline on a provider's behalf.
    await expect(page.getByRole("button", { name: /Record quote|Edit quote|Declined/ })).toHaveCount(0);
    await expect(page.getByLabel("Quoted amount (R)")).toHaveCount(0);
    await expect(page.getByText("Waiting for OreTech Services to reply.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose this provider" })).toHaveCount(0);

    await replyAs(page, "OreTech Services", async (provider) => {
      await provider.getByLabel("Quoted amount (R)").fill("18500");
      await provider.getByLabel("Your quote reference").fill("Q-1042");
      await provider.getByRole("button", { name: "Send quote" }).click();
      await expect(provider.getByText("Quote sent: R 18,500.00")).toBeVisible();
    });
    await expect(invite(page, "OreTech Services").getByText("Quote received")).toBeVisible();
    await expect(invite(page, "OreTech Services").getByText("R 18,500.00")).toBeVisible();

    await replyAs(page, "Karoo Crusher & Screen", async (provider) => {
      await provider.getByLabel("Quoted amount (R)").fill("16900");
      await provider.getByRole("button", { name: "Send quote" }).click();
      await expect(provider.getByText("Quote sent: R 16,900.00")).toBeVisible();
    });
    await expect(invite(page, "Karoo Crusher & Screen").getByText("Lowest quote")).toBeVisible();

    await invite(page, "Karoo Crusher & Screen").getByRole("button", { name: "Choose this provider" }).click();
    await expect(invite(page, "Karoo Crusher & Screen").getByText("Chosen")).toBeVisible();
    await expect(invite(page, "OreTech Services").getByText("Not selected")).toBeVisible();
    await expect(page.getByText(/does not place orders or make payments/)).toBeVisible();

    await page.getByRole("button", { name: "Book the work" }).click();
    await dialog(page).getByLabel("Date").fill("2025-05-06");
    await dialog(page).getByRole("button", { name: "Save booking" }).click();
    await expect(page.getByText("Scheduled").first()).toBeVisible();

    await page.getByRole("button", { name: "Mark complete" }).click();
    await dialog(page).getByLabel("What was done").fill("500 hour inspection done, liner checked.");
    await dialog(page).getByLabel(/Meter reading/).fill("4312");
    await dialog(page).getByRole("button", { name: "Complete and log" }).click();
    await expect(page.getByText("Completed").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark complete" })).toHaveCount(0);

    await page.getByRole("link", { name: /Primary Crusher C-02/ }).first().click();
    await expect(page.getByRole("link", { name: /500 hour inspection/ })).toBeVisible();
    await expect(page.getByRole("cell", { name: "SR-2025-001" })).toBeVisible();
  });

  test("records a decline and cancels a request with a reason", async ({ page }) => {
    await openAs(page, "/equipment/eq-crusher-c02/service/new", "John Dlamini");
    await page.getByLabel("Work required").fill("Replace feed chute liner");
    await page.getByRole("checkbox", { name: /OreTech Services/ }).check();
    await page.getByRole("checkbox", { name: /Karoo Crusher & Screen/ }).check();
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByRole("heading", { name: "Replace feed chute liner", level: 1 })).toBeVisible();

    await replyAs(page, "OreTech Services", async (provider) => {
      await provider.getByRole("button", { name: "Decline this request" }).click();
      await provider.getByLabel(/Reason/).fill("Fully booked this month");
      await provider.getByRole("button", { name: "Confirm decline" }).click();
      await expect(provider.getByText("Declined", { exact: true })).toBeVisible();
    });
    await expect(page.getByText("Declined: Fully booked this month")).toBeVisible();

    await page.getByRole("button", { name: "Cancel request" }).click();
    await dialog(page).getByLabel("Why is it being cancelled?").fill("Fault fixed in house");
    await dialog(page).getByRole("button", { name: "Cancel request" }).click();
    await expect(page.getByText("Fault fixed in house").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel request" })).toHaveCount(0);
  });

  test("will not delete a provider that appears on a request", async ({ page }) => {
    await openAs(page, "/equipment/eq-crusher-c02/service/new", "John Dlamini");
    await page.getByLabel("Work required").fill("Replace feed chute liner");
    await page.getByRole("checkbox", { name: /OreTech Services/ }).check();
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByRole("heading", { name: "Replace feed chute liner", level: 1 })).toBeVisible();
    await page.goto("/admin");
    await page.getByRole("tab", { name: "Service providers" }).click();
    await page.getByRole("button", { name: "Delete OreTech Services" }).click();
    await dialog(page).getByRole("button", { name: "Delete provider" }).click();
    await expect(page.getByText(/Deactivate them instead/).first()).toBeVisible();
  });

  test("keeps requesting service to the Mine Manager and the Maintenance Planner", async ({ page }) => {
    await openAs(page, "/equipment/eq-crusher-c02", "Amina Patel");
    await expect(page.getByRole("heading", { name: "Primary Crusher C-02", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Request service/ })).toHaveCount(0);
    await page.goto("/equipment/eq-crusher-c02/service/new");
    await expect(page.getByRole("heading", { name: /Service requests are made by the Mine Manager or the Maintenance Planner/ })).toBeVisible();
  });

  test("shows the new rights on the User rights tab", async ({ page }) => {
    await openAs(page, "/admin");
    await page.getByRole("tab", { name: "User rights" }).click();
    await expect(page.getByRole("img", { name: "Add, edit and delete service providers, Mine Manager: Allowed" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Add, edit and delete service providers, Maintenance Planner: Not allowed" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Request, compare and award service quotes, Maintenance Planner: Allowed" })).toBeVisible();
  });

  test("shows a provider only their own request, and closes once a provider is chosen", async ({ page }) => {
    await openAs(page, "/equipment/eq-crusher-c02/service/new", "Lebo Maseko");
    await page.getByLabel("Work required").fill("Replace feed chute liner");
    await page.getByRole("checkbox", { name: /OreTech Services/ }).check();
    await page.getByRole("checkbox", { name: /Karoo Crusher & Screen/ }).check();
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByRole("heading", { name: "Replace feed chute liner", level: 1 })).toBeVisible();

    const link = await page.getByLabel("Reply link for OreTech Services").inputValue();
    const provider = await page.context().newPage();
    await provider.goto(link);
    await expect(provider.getByText(/has asked OreTech Services to quote/)).toBeVisible();
    await expect(provider.getByText("Karoo Crusher & Screen")).toHaveCount(0);
    await expect(provider.getByRole("link")).toHaveCount(0);
    await expect(provider.getByRole("navigation")).toHaveCount(0);
    await provider.getByLabel("Quoted amount (R)").fill("12000");
    await provider.getByRole("button", { name: "Send quote" }).click();
    await expect(provider.getByText("Quote sent: R 12,000.00")).toBeVisible();

    await page.reload();
    await invite(page, "OreTech Services").getByRole("button", { name: "Choose this provider" }).click();
    await expect(invite(page, "OreTech Services").getByText("Chosen")).toBeVisible();

    await provider.reload();
    await expect(provider.getByText("The mine has chosen a provider for this work.")).toBeVisible();
    await expect(provider.getByLabel("Quoted amount (R)")).toHaveCount(0);

    const stranger = await page.context().newPage();
    await stranger.goto("/provider/respond/not-a-real-link");
    await expect(stranger.getByRole("heading", { name: "This link is not valid" })).toBeVisible();
  });
});
