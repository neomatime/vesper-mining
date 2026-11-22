// @vitest-environment node

/**
 * Unit tests (Vitest). Service provider management: the directory records, approval (pending, approved, inactive) and who may change it,
 * the audit history, deletion rules (never for a provider that repair requests refer to), duplicate prevention, and how approved providers
 * feed repair requests. Providers are fictional demonstration records.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoError, demoDomain } from "./demo-store";
import type { Actor } from "./issue-rules";
import { eligibleProviders, responseLabel } from "./service-rules";

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

const byName = (name: string) => demoDomain.listProviders().find((item) => item.name === name)!;
const input = { name: "Delta Hoist Services", registration: "2021/000777/07", contactName: "Sam Dube", email: "sam@deltahoist.example", phone: "+27 11 555 0100", categories: ["conveyor", "crusher"], specialisation: "Hoists and conveyor drives", serviceAreas: "Riverside Mine, Gauteng", responseHours: 6, approvedUntil: "", notes: "" };

beforeEach(() => demoDomain.reset());

describe("the directory", () => {
  it("has twelve fictional providers: nine approved, two pending and one inactive, without overwriting the earlier five", () => {
    const all = demoDomain.listProviders();
    expect(all).toHaveLength(12);
    const count = (approval: string) => all.filter((item) => item.approval === approval).length;
    expect([count("approved"), count("pending"), count("inactive")]).toEqual([9, 2, 1]);
    expect(byName("OreTech Services")).toMatchObject({ id: "prov-001", approval: "approved", active: true });
    expect(byName("Highveld Drilling Support")).toMatchObject({ approval: "inactive", active: false });
    expect(byName("AquaFlow Solutions")).toMatchObject({ approval: "pending", active: false });
    expect(new Set(all.map((item) => item.id)).size).toBe(12);
    expect(all.every((item) => item.history.length > 0)).toBe(true);
  });

  it("describes response times in words", () => {
    expect(responseLabel(2)).toBe("Within 2 hours");
    expect(responseLabel(1)).toBe("Within 1 hour");
    expect(responseLabel(24)).toBe("Within 1 day");
    expect(responseLabel(72)).toBe("Within 3 days");
    expect(responseLabel(null)).toBe("Not agreed");
  });
});

describe("creating", () => {
  it("starts as pending approval, whoever adds it, unless an approver explicitly approves it", () => {
    const pending = demoDomain.createProvider(input, planner);
    expect(pending).toMatchObject({ approval: "pending", active: false, specialisation: "Hoists and conveyor drives", serviceAreas: ["Riverside Mine", "Gauteng"], responseHours: 6 });
    expect(pending.history[0].summary).toBe("Added; waiting for approval");
    // A planner cannot approve by asking for it.
    expect(demoDomain.createProvider({ ...input, name: "Echo Hoists", registration: "2021/000778/07", approval: "approved" }, planner).approval).toBe("pending");
    const approved = demoDomain.createProvider({ ...input, name: "Foxtrot Hoists", registration: "2021/000779/07", approval: "approved" }, manager);
    expect(approved).toMatchObject({ approval: "approved", active: true });
    rejects(() => demoDomain.createProvider({ ...input, name: "Nobody Allowed", registration: "1" }, supervisor), 403);
  });

  it("validates on the server and refuses duplicates by name or registration number", () => {
    rejects(() => demoDomain.createProvider({ ...input, name: "ab" }, manager), 400);
    rejects(() => demoDomain.createProvider({ ...input, email: "nope" }, manager), 400, /valid email/);
    rejects(() => demoDomain.createProvider({ ...input, categories: [] }, manager), 400, /at least one/);
    rejects(() => demoDomain.createProvider({ ...input, responseHours: -3 }, manager), 400, /response time/);
    rejects(() => demoDomain.createProvider({ ...input, name: "oretech services" }, manager), 409, /name is already/);
    rejects(() => demoDomain.createProvider({ ...input, registration: "2012/118344/07" }, manager), 409, /registration number is already/);
  });

  it("does not create two records from one repeated submission", () => {
    const once = { ...input, submissionId: "provider-submit-1" };
    demoDomain.createProvider(once, manager);
    rejects(() => demoDomain.createProvider(once, manager), 409);
    expect(demoDomain.listProviders().filter((item) => item.name === input.name)).toHaveLength(1);
  });
});

describe("approval and the audit history", () => {
  it("is changed only by the Mine Manager, needs a reason to deactivate, and every change is recorded", () => {
    const created = demoDomain.createProvider(input, planner);
    rejects(() => demoDomain.setProviderApproval(created.id, { approval: "approved" }, planner), 403);
    const approved = demoDomain.setProviderApproval(created.id, { approval: "approved", note: "Safety file checked." }, manager);
    expect(approved).toMatchObject({ approval: "approved", active: true });
    rejects(() => demoDomain.setProviderApproval(created.id, { approval: "approved" }, manager), 409, /already approved/);
    rejects(() => demoDomain.setProviderApproval(created.id, { approval: "inactive", note: "" }, manager), 400);
    const inactive = demoDomain.setProviderApproval(created.id, { approval: "inactive", note: "Insurance lapsed." }, manager);
    expect(inactive).toMatchObject({ approval: "inactive", active: false });
    expect(inactive.history.map((line) => line.summary)).toEqual(["Added; waiting for approval", "Approval changed from pending approval to approved", "Approval changed from approved to inactive"]);
    expect(inactive.history.at(-1)).toMatchObject({ actor: "John Dlamini", note: "Insurance lapsed." });
    expect(demoDomain.setProviderApproval(created.id, { approval: "approved" }, manager).history.at(-1)!.summary).toBe("Approval changed from inactive to approved");
  });

  it("records what an edit changed, and keeps the approval status out of an ordinary edit", () => {
    const created = demoDomain.createProvider(input, planner);
    const updated = demoDomain.updateProvider(created.id, { ...input, phone: "+27 11 555 0999", responseHours: 4, version: created.version }, planner);
    expect(updated.history.at(-1)!.summary).toBe("Updated phone, response time");
    expect(updated.approval).toBe("pending");
    const same = demoDomain.updateProvider(created.id, { ...input, phone: "+27 11 555 0999", responseHours: 4, version: updated.version }, planner);
    expect(same.history).toHaveLength(updated.history.length);
  });
});

describe("deleting", () => {
  it("permanently removes only an unreferenced provider, and only for the Mine Manager", () => {
    const created = demoDomain.createProvider(input, planner);
    rejects(() => demoDomain.deleteProvider(created.id, planner), 403);
    expect(demoDomain.providerDetail(created.id).canDelete).toBe(true);
    demoDomain.deleteProvider(created.id, manager);
    expect(demoDomain.listProviders().some((item) => item.id === created.id)).toBe(false);
  });

  it("refuses to delete a provider that repair requests refer to, and deactivating keeps the history", () => {
    const request = demoDomain.createServiceRequest({ equipmentId: "eq-crusher-c02", title: "500 hour inspection", urgency: "urgent", preferredDate: "2025-05-05", providerIds: [byName("OreTech Services").id] }, planner);
    const provider = byName("OreTech Services");
    const detail = demoDomain.providerDetail(provider.id);
    expect(detail.canDelete).toBe(false);
    expect(detail.requests.map((item) => item.number)).toEqual([request.number]);
    rejects(() => demoDomain.deleteProvider(provider.id, manager), 409, new RegExp(`${request.number}.*Deactivate`));
    const inactive = demoDomain.setProviderApproval(provider.id, { approval: "inactive", note: "Paused while contracts are renewed.", version: provider.version }, manager);
    expect(inactive.approval).toBe("inactive");
    expect(demoDomain.providerDetail(provider.id).requests).toHaveLength(1);
  });
});

describe("what a provider's page reports", () => {
  it("counts only recorded requests and replies, and never estimates a reply time", () => {
    const provider = byName("OreTech Services");
    expect(demoDomain.providerDetail(provider.id).performance).toEqual({ asked: 0, replied: 0, declined: 0, completedJobs: 0, averageReplyHours: null });
    demoDomain.createServiceRequest({ equipmentId: "eq-crusher-c02", title: "Liner inspection", urgency: "routine", preferredDate: "2025-05-05", providerIds: [provider.id] }, planner);
    expect(demoDomain.providerDetail(provider.id).performance).toMatchObject({ asked: 1, replied: 0, averageReplyHours: null });
  });
});

describe("repair requests", () => {
  it("offer only approved providers that match the category and serve the site", () => {
    const now = demoDomain.now();
    const names = (category: Parameters<typeof eligibleProviders>[1]) => eligibleProviders(demoDomain.listProviders(), category, now, "Riverside Mine").map((item) => item.name);
    expect(names("conveyor")).toEqual(["ABC Industrial Repairs"]);
    // AquaFlow serves pumps and pipelines but is pending; OreTech is the approved pump provider.
    expect(names("pump")).toEqual(["OreTech Services"]);
    expect(names("substation")).toEqual(["PowerTech Services"]);
    // A provider that does not serve this site is not offered.
    expect(eligibleProviders(demoDomain.listProviders(), "crusher", now, "Another Mine")).toEqual([]);
  });

  it("refuses pending and inactive providers for new work, and offers a provider once it is approved", () => {
    const aqua = byName("AquaFlow Solutions");
    rejects(() => demoDomain.createServiceRequest({ equipmentId: "eq-pwp-03", title: "Pump service", urgency: "routine", preferredDate: "2025-05-05", providerIds: [aqua.id] }, planner), 400, /not approved/);
    demoDomain.setProviderApproval(aqua.id, { approval: "approved", note: "" }, manager);
    expect(demoDomain.createServiceRequest({ equipmentId: "eq-pwp-03", title: "Pump service", urgency: "routine", preferredDate: "2025-05-05", providerIds: [aqua.id] }, planner).invites).toHaveLength(1);
    const highveld = byName("Highveld Drilling Support");
    rejects(() => demoDomain.createServiceRequest({ equipmentId: "eq-pwp-03", title: "Pump service two", urgency: "routine", preferredDate: "2025-05-06", providerIds: [highveld.id] }, planner), 400, /not approved/);
  });
});
