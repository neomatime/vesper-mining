// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { DemoError, demoDomain } from "./demo-store";
import type { Actor } from "./issue-rules";

const manager: Actor = { name: "John Dlamini", role: "Mine Manager" };
const supervisor: Actor = { name: "Amina Patel", role: "Shift Supervisor" };
const planner: Actor = { name: "Lebo Maseko", role: "Maintenance Planner" };
const stores: Actor = { name: "Naledi Khoza", role: "Stores / Inventory Controller" };
const field: Actor = { name: "Thabo Molefe", role: "Field Employee" };

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

const input = { name: "Haul Truck HT-301", code: "ht 301", category: "haul_truck", areaId: "area-central-pit", hours: 1200, hoursPerDay: 14 };

beforeEach(() => demoDomain.reset());

describe("adding equipment", () => {
  it("creates a record with a tidy code, a history entry and a place on the register", () => {
    const created = demoDomain.createEquipment(input, planner);
    expect(created.code).toBe("HT-301");
    expect(created.areaName).toBe("Central Pit");
    expect(created.events[0]).toMatchObject({ type: "created", actor: planner.name });
    expect(demoDomain.listEquipment().map((item) => item.id)).toContain(created.id);
  });

  it("rejects missing or invalid details with a clear message", () => {
    rejects(() => demoDomain.createEquipment({ ...input, name: "x" }, planner), 400, /name/i);
    rejects(() => demoDomain.createEquipment({ ...input, code: "!" }, planner), 400, /asset code/i);
    rejects(() => demoDomain.createEquipment({ ...input, category: "spaceship" }, planner), 400, /category/i);
    rejects(() => demoDomain.createEquipment({ ...input, areaId: "area-moon" }, planner), 400, /area/i);
    rejects(() => demoDomain.createEquipment({ ...input, hours: -5 }, planner), 400, /at least 0/);
    rejects(() => demoDomain.createEquipment({ ...input, hoursPerDay: 30 }, planner), 400, /24 or less/);
  });

  it("keeps asset codes unique, including retired equipment", () => {
    demoDomain.createEquipment(input, planner);
    rejects(() => demoDomain.createEquipment({ ...input, name: "Another truck", code: "HT-301" }, planner), 409, /already used/);
    rejects(() => demoDomain.createEquipment({ ...input, name: "Excavator copy", code: "ex-204" }, planner), 409, /already used/);
  });

  it("limits adding to the Mine Manager and Maintenance Planner", () => {
    rejects(() => demoDomain.createEquipment(input, supervisor), 403);
    rejects(() => demoDomain.createEquipment(input, field), 403);
    expect(demoDomain.createEquipment(input, manager).code).toBe("HT-301");
  });
});

describe("editing equipment", () => {
  it("records what changed, and detects a conflicting edit", () => {
    const item = demoDomain.getEquipment("eq-dz017");
    const updated = demoDomain.updateEquipment("eq-dz017", { name: "Track Dozer DZ-017 (spare)", areaId: "area-rom-pad", version: item.version }, planner);
    expect(updated.name).toMatch(/spare/);
    expect(updated.events.at(-1)?.summary).toMatch(/name, area/);
    rejects(() => demoDomain.updateEquipment("eq-dz017", { notes: "Stale edit", version: item.version }, planner), 409, /changed while/);
  });

  it("will not let two assets share a code", () => {
    rejects(() => demoDomain.updateEquipment("eq-dz017", { code: "EX-204" }, planner), 409, /already used/);
  });
});

describe("availability and readings", () => {
  it("needs a reason to report unavailable, and never marks it verified", () => {
    rejects(() => demoDomain.setEquipmentState("eq-ex204", { state: "unavailable" }, supervisor), 400, /reason/i);
    const down = demoDomain.setEquipmentState("eq-ex204", { state: "unavailable", note: "Hydraulic leak at the boom cylinder." }, supervisor);
    expect(down.state).toBe("unavailable");
    expect(down.stateQuality).toBe("reported");
    rejects(() => demoDomain.setEquipmentState("eq-ex204", { state: "available" }, field), 403);
  });

  it("only lets the meter go down as a correction with a reason", () => {
    rejects(() => demoDomain.recordReading("eq-ex204", { hours: 790 }, field), 409, /lower than the last reading/);
    rejects(() => demoDomain.recordReading("eq-ex204", { hours: 790, correction: true }, field), 400, /reason/i);
    const fixed = demoDomain.recordReading("eq-ex204", { hours: 790, correction: true, note: "Last reading was keyed in wrongly." }, field);
    expect(fixed.hours).toBe(790);
    expect(fixed.events.at(-1)?.summary).toMatch(/corrected from 800 to 790/);
  });

  it("moves the next service forward when the reading goes up", () => {
    const before = demoDomain.getEquipment("eq-ex204").nextService;
    expect(before?.label).toBe("Due in 20 days");
    const after = demoDomain.recordReading("eq-ex204", { hours: 900 }, planner).nextService;
    expect(after?.state).toBe("due_soon");
    expect(after?.remainingHours).toBe(100);
  });
});

describe("maintenance plans and service history", () => {
  it("adds, edits and removes a plan, working out when it is due", () => {
    const withPlan = demoDomain.addPlan("eq-ex204", { name: "Monthly inspection", basis: "days", interval: 60, lastServiceAt: "2025-04-01T08:00:00+02:00" }, planner);
    const plan = withPlan.plans.find((item) => item.name === "Monthly inspection");
    expect(withPlan.maintenance.find((status) => status.planId === plan?.id)?.state).toBe("ok");
    const edited = demoDomain.updatePlan("eq-ex204", plan!.id, { name: "Monthly inspection", basis: "days", interval: 14, lastServiceAt: "2025-04-01T08:00:00+02:00" }, planner);
    expect(edited.maintenance.find((status) => status.planId === plan?.id)?.state).toBe("overdue");
    expect(demoDomain.removePlan("eq-ex204", plan!.id, {}, planner).plans.some((item) => item.id === plan!.id)).toBe(false);
  });

  it("will not accept a last service above the current reading", () => {
    rejects(() => demoDomain.addPlan("eq-ex204", { name: "Odd plan", basis: "hours", interval: 500, lastServiceHours: 5000 }, planner), 400, /current reading/);
    rejects(() => demoDomain.addPlan("eq-ex204", { name: "Odd plan", basis: "hours", interval: 0 }, planner), 400, /more than 0/);
  });

  it("resets a plan when a service is logged and raises the meter if it is higher", () => {
    const item = demoDomain.getEquipment("eq-dz017");
    expect(item.nextService?.state).toBe("due_soon");
    const logged = demoDomain.logService(
      "eq-dz017",
      { type: "service", planId: "plan-dz017-250", hours: 8250, summary: "250 hour service completed, filters changed.", workOrderRef: "CMMS-WO-2100" },
      supervisor,
    );
    expect(logged.hours).toBe(8250);
    expect(logged.plans[0].lastServiceHours).toBe(8250);
    expect(logged.nextService?.state).toBe("ok");
    expect(logged.services[0]).toMatchObject({ workOrderRef: "CMMS-WO-2100", performedBy: supervisor.name });
  });

  it("keeps service entries honest", () => {
    rejects(() => demoDomain.logService("eq-dz017", { type: "inspection", planId: "plan-dz017-250", summary: "Looked it over." }, supervisor), 400, /Only a service/);
    rejects(() => demoDomain.logService("eq-dz017", { type: "service", summary: "Future service logged.", performedAt: "2026-01-01T08:00:00+02:00" }, supervisor), 400, /future/);
    rejects(() => demoDomain.logService("eq-dz017", { type: "service", summary: "ok" }, supervisor), 400, /summary/i);
    rejects(() => demoDomain.logService("eq-dz017", { type: "service", summary: "Oil and filters changed." }, field), 403);
  });
});

describe("retiring, restoring and deleting", () => {
  it("will not retire equipment that still has open work", () => {
    rejects(() => demoDomain.retireEquipment("eq-crusher-c02", { reason: "End of life." }, planner), 409, /RIV-2025-041/);
    rejects(() => demoDomain.retireEquipment("eq-ex204", { reason: "Sold to another site." }, planner), 409, /upcoming maintenance/);
  });

  it("retires with a reason, keeps the history read-only, and restores", () => {
    const retired = demoDomain.retireEquipment("eq-dz017", { reason: "Sold to another operator." }, planner);
    expect(retired.retiredAt).not.toBeNull();
    expect(retired.retiredReason).toMatch(/Sold/);
    rejects(() => demoDomain.updateEquipment("eq-dz017", { notes: "Edit after retirement" }, planner), 409, /read-only/);
    rejects(() => demoDomain.logService("eq-dz017", { type: "service", summary: "Service after retirement." }, planner), 409, /read-only/);
    const back = demoDomain.restoreEquipment("eq-dz017", planner);
    expect(back.retiredAt).toBeNull();
    expect(back.events.map((event) => event.type)).toEqual(expect.arrayContaining(["retired", "restored"]));
  });

  it("deletes only records made in error, and points to retiring for anything with history", () => {
    rejects(() => demoDomain.deleteEquipment("eq-dz017", planner), 409, /Retire it instead/);
    const created = demoDomain.createEquipment(input, planner);
    expect(demoDomain.deleteEquipment(created.id, planner)).toEqual({ id: created.id, deleted: true });
    expect(demoDomain.listEquipment().some((item) => item.id === created.id)).toBe(false);
    rejects(() => demoDomain.getEquipment(created.id), 404);
  });

  it("will not delete once something has been recorded against it", () => {
    const created = demoDomain.createEquipment(input, planner);
    demoDomain.recordReading(created.id, { hours: 1300 }, planner);
    rejects(() => demoDomain.deleteEquipment(created.id, planner), 409, /recorded activity/);
    rejects(() => demoDomain.deleteEquipment(created.id, stores), 403);
  });
});

describe("linked work", () => {
  it("shows linked issues and upcoming maintenance on the record", () => {
    const crusher = demoDomain.getEquipment("eq-crusher-c02");
    expect(crusher.linkedIssues.map((issue) => issue.issueNumber)).toContain("RIV-2025-041");
    const excavator = demoDomain.getEquipment("eq-ex204");
    expect(excavator.readiness.map((activity) => activity.id)).toContain("readiness-ex204-1000h");
  });
});
