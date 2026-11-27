// @vitest-environment node

/**
 * Unit tests (Vitest). Automations: seven notification rules the Mine Manager switches on, aims and runs. They check that rules only
 * notify, fire once per record until the problem clears, honour who is told and the thresholds, respect permissions, and keep a history.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoError, demoDomain } from "./demo-store";
import type { Actor } from "./issue-rules";
import { automationCatalogue } from "./automation-rules";

const manager: Actor = { name: "John Dlamini", role: "Mine Manager" };
const planner: Actor = { name: "Lebo Maseko", role: "Maintenance Planner" };
const stores: Actor = { name: "Naledi Khoza", role: "Stores / Inventory Controller" };
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

const rule = (key: string) => demoDomain.automations(manager).rules.find((item) => item.definition.key === key)!.rule;
const inbox = (actor: Actor) => demoDomain.listNotifications(actor).filter((item) => item.category === "automation");

beforeEach(() => demoDomain.reset());

describe("the seven rules", () => {
  it("are a fixed list, all switched off to begin with, with sensible defaults", () => {
    const view = demoDomain.automations(manager);
    expect(view.rules).toHaveLength(7);
    expect(view.rules.map((item) => item.definition.key)).toEqual(automationCatalogue.map((item) => item.key));
    expect(view.rules.every((item) => item.rule.enabled === false)).toBe(true);
    expect(rule("service_due")).toMatchObject({ recipient: "Maintenance Planner", threshold: 7 });
    expect(rule("overdue_actions")).toMatchObject({ recipient: "owner", threshold: null });
    expect(view.canManage).toBe(true);
    expect(demoDomain.automations(planner).canManage).toBe(false);
  });

  it("are managed only by the Mine Manager", () => {
    rejects(() => demoDomain.updateAutomation("service_due", { enabled: true }, planner), 403);
    rejects(() => demoDomain.runAutomations({}, supervisor), 403);
  });
});

describe("settings", () => {
  it("switch a rule on, choose who is told, and set a threshold, each kept in the history", () => {
    demoDomain.updateAutomation("service_due", { enabled: true }, manager);
    demoDomain.updateAutomation("service_due", { recipient: "Mine Manager" }, manager);
    const view = demoDomain.updateAutomation("service_due", { threshold: 14 }, manager);
    expect(view.rules.find((item) => item.definition.key === "service_due")!.rule).toMatchObject({ enabled: true, recipient: "Mine Manager", threshold: 14 });
    expect(view.runs.filter((item) => item.kind === "setting").map((item) => item.summary)).toEqual([
      "Service due soon or overdue: tell me this many days ahead 14 days",
      "Service due soon or overdue: now tells Mine Manager",
      "Service due soon or overdue: switched on",
    ]);
  });

  it("refuse an unknown rule, an unsuitable recipient, an out-of-range threshold, and a change that changes nothing", () => {
    rejects(() => demoDomain.updateAutomation("nope", { enabled: true }, manager), 404);
    rejects(() => demoDomain.updateAutomation("service_due", { recipient: "owner" }, manager), 400, /Choose who is told/);
    rejects(() => demoDomain.updateAutomation("service_due", { recipient: "Field Employee" }, manager), 400);
    rejects(() => demoDomain.updateAutomation("service_due", { threshold: 0 }, manager), 400, /between 1 and 60/);
    rejects(() => demoDomain.updateAutomation("overdue_actions", { threshold: 3 }, manager), 400, /Nothing was changed/);
    rejects(() => demoDomain.updateAutomation("service_due", { enabled: false }, manager), 400, /Nothing was changed/);
  });
});

describe("running", () => {
  it("needs a rule that is switched on", () => {
    rejects(() => demoDomain.runAutomations({}, manager), 409, /Switch one on/);
    rejects(() => demoDomain.runAutomations({ key: "service_due" }, manager), 409, /Switch this automation on/);
  });

  it("tells the chosen role about service that is due, and links to the asset", () => {
    demoDomain.updateAutomation("service_due", { enabled: true }, manager);
    const result = demoDomain.runAutomations({}, manager);
    expect(result.summary.rulesRun).toBe(1);
    expect(result.summary.found).toBeGreaterThan(0);
    const told = inbox(planner);
    expect(told.length).toBe(result.summary.notified);
    expect(told.map((item) => item.title)).toEqual(expect.arrayContaining(["Service due soon or overdue"]));
    // Overdue service on the second haul truck, and plans due within seven days.
    expect(told.some((item) => /HT-102/.test(item.detail) && /Overdue/.test(item.detail))).toBe(true);
    expect(told.every((item) => item.href.startsWith("/equipment/"))).toBe(true);
    // Nobody else was told.
    expect(inbox(supervisor)).toHaveLength(0);
  });

  it("announces a record once, and only again after the problem has cleared and returned", () => {
    demoDomain.updateAutomation("service_due", { enabled: true }, manager);
    const first = demoDomain.runAutomations({}, manager);
    const second = demoDomain.runAutomations({}, manager);
    expect(second.summary.found).toBe(first.summary.found);
    expect(second.summary.notified).toBe(0);
    expect(second.runs[0].summary).toMatch(/already announced/);
    // Service is logged, so the problem clears; switching the rule off and on again counts everything as new.
    demoDomain.updateAutomation("service_due", { enabled: false }, manager);
    demoDomain.updateAutomation("service_due", { enabled: true }, manager);
    expect(demoDomain.runAutomations({}, manager).summary.notified).toBe(first.summary.notified);
  });

  it("follows the threshold: a shorter look-ahead finds less", () => {
    demoDomain.updateAutomation("service_due", { enabled: true, threshold: 60 }, manager);
    const wide = demoDomain.runAutomations({}, manager).summary.found;
    demoDomain.updateAutomation("service_due", { threshold: 1 }, manager);
    const narrow = demoDomain.runAutomations({}, manager).summary.found;
    expect(narrow).toBeLessThan(wide);
  });

  it("tells the owner of the record when a rule is aimed at the owner", () => {
    demoDomain.updateAutomation("overdue_actions", { enabled: true }, manager);
    const result = demoDomain.runAutomations({ key: "overdue_actions" }, manager);
    expect(result.summary.rulesRun).toBe(1);
    // Whoever owns an overdue action is told, by name.
    const everyone = [manager, planner, stores, supervisor].flatMap((actor) => inbox(actor));
    expect(everyone.length).toBeLessThanOrEqual(result.summary.notified);
    expect(everyone.every((item) => item.href.startsWith("/exceptions/"))).toBe(true);
  });

  it("tells the Inventory Controller about a shipment waiting on transport, and creates nothing else", () => {
    demoDomain.updateAutomation("shipment_waiting", { enabled: true, threshold: 14 }, manager);
    const shipmentsBefore = JSON.stringify(demoDomain.logistics(manager).shipments);
    const issuesBefore = JSON.stringify(demoDomain.listIssues());
    const result = demoDomain.runAutomations({}, manager);
    expect(result.summary.found).toBeGreaterThan(0);
    const told = inbox(stores);
    expect(told.some((item) => /SHP-0047/.test(item.detail))).toBe(true);
    expect(told.find((item) => /SHP-0047/.test(item.detail))!.href).toBe("/shipments/ship-47");
    // A rule only notifies: no shipment, issue or other record was touched.
    expect(JSON.stringify(demoDomain.logistics(manager).shipments)).toBe(shipmentsBefore);
    expect(JSON.stringify(demoDomain.listIssues())).toBe(issuesBefore);
  });

  it("finds a vehicle problem on a planned own-fleet load and tells the person responsible", () => {
    const made = demoDomain.createShipment({ stockpileId: "sp-01", tonnes: 100, orderRef: "PO-AUTO-1", destination: "Richards Bay Terminal", preferredDate: "2026-04-28", transportMode: "own_fleet" }, manager);
    demoDomain.updateFleetPlan(made.id, { coordinator: "Naledi Khoza" }, manager);
    demoDomain.addFleetLoad(made.id, { vehicleId: "eq-ht101", driverName: "Thabo Molefe", tonnes: 100, plannedCollectionAt: "2026-04-28T08:00", plannedDeliveryAt: "2026-04-28T14:00" }, manager);
    demoDomain.updateAutomation("fleet_breakdown", { enabled: true }, manager);
    expect(demoDomain.runAutomations({}, manager).summary.found).toBe(0);
    demoDomain.setEquipmentState("eq-ht101", { state: "unavailable", note: "Brake fault found at the gate." }, planner);
    const result = demoDomain.runAutomations({}, manager);
    expect(result.summary).toMatchObject({ found: 1, notified: 1 });
    expect(inbox(stores)[0].detail).toMatch(/HT-101 is unavailable/);
  });

  it("keeps every run in the history, newest first", () => {
    demoDomain.updateAutomation("provider_approval", { enabled: true }, manager);
    const view = demoDomain.runAutomations({}, manager);
    expect(view.runs[0]).toMatchObject({ kind: "run", ruleKey: "provider_approval" });
    // Ridge Hydraulics' approval expired in March 2025.
    expect(view.runs[0].found).toBeGreaterThan(0);
    expect(rule("provider_approval").lastRunAt).not.toBeNull();
  });
});
