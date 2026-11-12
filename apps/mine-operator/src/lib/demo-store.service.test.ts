// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { DemoError, demoDomain } from "./demo-store";
import type { Actor } from "./issue-rules";
import { eligibleProviders } from "./service-rules";

const manager: Actor = { name: "John Dlamini", role: "Mine Manager" };
const planner: Actor = { name: "Lebo Maseko", role: "Maintenance Planner" };
const supervisor: Actor = { name: "Amina Patel", role: "Shift Supervisor" };

function rejects(operation: () => unknown, status: number, pattern?: RegExp) {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(DemoError);
    expect((error as DemoError).status).toBe(status);
    if (pattern) expect((error as DemoError).message).toMatch(pattern);
    return;
  }
  throw new Error("Expected the operation to be rejected.");
}

const provider = { name: "Delta Mining Services", registration: "2020/000001/07", contactName: "Sam Dube", email: "sam@delta.example", phone: "+27 11 555 0100", categories: ["crusher", "pump"], approvedUntil: "2026-12-31", notes: "" };
const crusher = "eq-crusher-c02";
const byName = (name: string) => demoDomain.listProviders().find((item) => item.name === name)!;

const baseRequest = () => ({ equipmentId: crusher, title: "500 hour inspection", urgency: "urgent", preferredDate: "2025-05-05", providerIds: [byName("OreTech Services").id, byName("Karoo Crusher & Screen").id] });

beforeEach(() => demoDomain.reset());

describe("service providers", () => {
  it("lets only the Mine Manager add, edit, deactivate and delete providers", () => {
    rejects(() => demoDomain.createProvider(provider, planner), 403);
    const created = demoDomain.createProvider(provider, manager);
    expect(created).toMatchObject({ name: "Delta Mining Services", active: true, version: 1 });
    rejects(() => demoDomain.updateProvider(created.id, { ...provider, phone: "x" }, supervisor), 403);
    const before = created.version;
    const updated = demoDomain.updateProvider(created.id, { ...provider, phone: "+27 11 555 0111", version: before }, manager);
    expect(updated).toMatchObject({ phone: "+27 11 555 0111", version: before + 1 });
    rejects(() => demoDomain.updateProvider(created.id, { ...provider, version: before }, manager), 409, /changed by someone else/);
    expect(demoDomain.setProviderActive(created.id, false, manager).active).toBe(false);
    demoDomain.deleteProvider(created.id, manager);
    expect(demoDomain.listProviders().some((item) => item.id === created.id)).toBe(false);
  });

  it("validates the details", () => {
    rejects(() => demoDomain.createProvider({ ...provider, name: "OreTech Services" }, manager), 409, /already on the list/);
    rejects(() => demoDomain.createProvider({ ...provider, email: "nope" }, manager), 400, /valid email/);
    rejects(() => demoDomain.createProvider({ ...provider, categories: [] }, manager), 400, /at least one kind/);
    rejects(() => demoDomain.createProvider({ ...provider, categories: ["spaceship"] }, manager), 400, /not recognised/);
    rejects(() => demoDomain.createProvider({ ...provider, approvedUntil: "31/12/2026" }, manager), 400, /date/);
  });

  it("offers only active, approved providers that service the equipment", () => {
    const names = eligibleProviders(demoDomain.listProviders(), "crusher", demoDomain.now()).map((item) => item.name);
    expect(names).toEqual(["OreTech Services", "Karoo Crusher & Screen"]);
    expect(eligibleProviders(demoDomain.listProviders(), "excavator", demoDomain.now()).map((item) => item.name)).toEqual(["OreTech Services"]);
    // Ridge Hydraulics has an expired approval and Highveld is deactivated.
    expect(names).not.toContain("Ridge Hydraulics");
  });
});

describe("requesting service", () => {
  it("is limited to the Mine Manager and the Maintenance Planner", () => {
    rejects(() => demoDomain.createServiceRequest(baseRequest(), supervisor), 403);
    const request = demoDomain.createServiceRequest(baseRequest(), planner);
    expect(request).toMatchObject({ status: "open", number: "SR-2025-001", urgency: "urgent" });
    expect(request.invites.map((invite) => invite.state)).toEqual(["sent", "sent"]);
  });

  it("refuses providers that are not approved for the equipment", () => {
    rejects(() => demoDomain.createServiceRequest({ ...baseRequest(), providerIds: [byName("Ridge Hydraulics").id] }, manager), 400, /not approved/);
    rejects(() => demoDomain.createServiceRequest({ ...baseRequest(), providerIds: [byName("Northgate Fleet Services").id] }, manager), 400, /not approved/);
    rejects(() => demoDomain.createServiceRequest({ ...baseRequest(), providerIds: [] }, manager), 400, /at least one/);
  });

  it("goes from quotes to a chosen provider, a booking and a logged service", () => {
    const request = demoDomain.createServiceRequest({ ...baseRequest(), planId: "plan-c02-500" }, manager);
    const [first, second] = request.invites;
    rejects(() => demoDomain.awardInvite(request.id, first.id, {}, manager), 409, /Record this provider/);
    demoDomain.providerRespond(first.token, { action: "quote", amount: "18500", reference: "Q-1042", availableFrom: "2025-05-06" });
    demoDomain.providerRespond(second.token, { action: "quote", amount: "16900", validUntil: "2025-05-30" });
    demoDomain.awardInvite(request.id, second.id, {}, manager);
    expect(demoDomain.getServiceRequest(request.id).invites.map((invite) => invite.state)).toEqual(["not_selected", "accepted"]);
    expect(demoDomain.getServiceRequest(request.id).status).toBe("awarded");
    rejects(() => demoDomain.providerRespond(first.token, { action: "quote", amount: "1" }), 409, /no longer open/);

    rejects(() => demoDomain.scheduleRequest(request.id, { date: "2025-04-01" }, manager), 400, /past/);
    demoDomain.scheduleRequest(request.id, { date: "2025-05-06" }, manager);
    expect(demoDomain.getServiceRequest(request.id)).toMatchObject({ status: "scheduled", scheduledFor: "2025-05-06" });

    const servicesBefore = demoDomain.getEquipment(crusher).services.length;
    demoDomain.completeRequest(request.id, { summary: "500 hour inspection done, liner checked.", hours: 4312 }, manager);
    const done = demoDomain.getServiceRequest(request.id);
    expect(done.status).toBe("completed");
    expect(demoDomain.getEquipment(crusher).services.length).toBe(servicesBefore + 1);
    expect(demoDomain.getEquipment(crusher).services.find((entry) => entry.workOrderRef === "SR-2025-001")).toMatchObject({ planId: "plan-c02-500" });
    rejects(() => demoDomain.cancelRequest(request.id, { reason: "Changed our mind" }, manager), 409, /completed/);
  });

  it("records a decline and cancels a request with a reason", () => {
    const request = demoDomain.createServiceRequest(baseRequest(), manager);
    demoDomain.providerRespond(request.invites[0].token, { action: "decline", reason: "Fully booked" });
    expect(demoDomain.getServiceRequest(request.id).invites[0]).toMatchObject({ state: "declined", declinedReason: "Fully booked" });
    rejects(() => demoDomain.cancelRequest(request.id, { reason: "" }, manager), 400);
    demoDomain.cancelRequest(request.id, { reason: "Fault fixed in-house" }, manager);
    expect(demoDomain.getServiceRequest(request.id)).toMatchObject({ status: "cancelled", cancelledReason: "Fault fixed in-house" });
  });

  it("keeps providers that appear on requests, deactivating instead of deleting", () => {
    demoDomain.createServiceRequest(baseRequest(), manager);
    rejects(() => demoDomain.deleteProvider(byName("OreTech Services").id, manager), 409, /Deactivate them instead/);
  });

  it("lists requests per equipment", () => {
    demoDomain.createServiceRequest(baseRequest(), manager);
    expect(demoDomain.listServiceRequests(crusher)).toHaveLength(1);
    expect(demoDomain.listServiceRequests("eq-ex204")).toHaveLength(0);
  });

  it("never lets the mine write or change a quote", () => {
    const loose = demoDomain as unknown as Record<string, unknown>;
    expect(loose.recordQuote).toBeUndefined();
    expect(loose.declineInvite).toBeUndefined();
    const request = demoDomain.createServiceRequest(baseRequest(), manager);
    expect(request.invites.every((invite) => invite.quote === null && invite.state === "sent")).toBe(true);
    // Choosing a provider needs the provider's own quote first.
    rejects(() => demoDomain.awardInvite(request.id, request.invites[0].id, {}, manager), 409, /Record this provider|quote/);
  });
});

describe("the provider's reply link", () => {
  it("shows a provider only their own job and no other provider", () => {
    const request = demoDomain.createServiceRequest(baseRequest(), manager);
    const view = demoDomain.providerView(request.invites[0].token);
    expect(view).toMatchObject({ providerName: "OreTech Services", title: "500 hour inspection", open: true, state: "sent" });
    expect(JSON.stringify(view)).not.toContain("Karoo");
    expect(request.invites[0].token).not.toBe(request.invites[1].token);
  });

  it("lets the provider quote, revise the quote and change their mind about declining", () => {
    const request = demoDomain.createServiceRequest(baseRequest(), manager);
    const { token } = request.invites[0];
    expect(demoDomain.providerRespond(token, { action: "quote", amount: "18 500", reference: "Q-1" }).quote).toMatchObject({ amount: 18500, recordedBy: "OreTech Services" });
    expect(demoDomain.providerRespond(token, { action: "quote", amount: "17900" }).quote?.amount).toBe(17900);
    expect(demoDomain.providerRespond(token, { action: "decline", reason: "Cannot make it" })).toMatchObject({ state: "declined", quote: null });
    expect(demoDomain.providerRespond(token, { action: "quote", amount: "19000" }).state).toBe("quoted");
    const events = demoDomain.getServiceRequest(request.id).events.map((event) => event.summary);
    expect(events).toContain("OreTech Services sent a quote");
    expect(events).toContain("OreTech Services declined");
  });

  it("validates the quote and rejects unknown links", () => {
    const request = demoDomain.createServiceRequest(baseRequest(), manager);
    const { token } = request.invites[0];
    rejects(() => demoDomain.providerRespond(token, { action: "quote", amount: "" }), 400, /quoted amount/);
    rejects(() => demoDomain.providerRespond(token, { action: "quote", amount: "-5" }), 400, /quoted amount/);
    rejects(() => demoDomain.providerRespond(token, { action: "quote", amount: "100", availableFrom: "soon" }), 400, /date/);
    rejects(() => demoDomain.providerView("nope"), 404, /not valid/);
  });

  it("closes once the mine has chosen a provider or cancelled", () => {
    const request = demoDomain.createServiceRequest(baseRequest(), manager);
    const [first, second] = request.invites;
    demoDomain.providerRespond(first.token, { action: "quote", amount: "1000" });
    demoDomain.awardInvite(request.id, first.id, {}, manager);
    expect(demoDomain.providerView(second.token)).toMatchObject({ open: false });
    rejects(() => demoDomain.providerRespond(second.token, { action: "quote", amount: "900" }), 409, /no longer open/);
    expect(demoDomain.providerView(first.token).closedReason).toMatch(/chosen a provider/);
  });
});
