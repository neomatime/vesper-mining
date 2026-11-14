// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { DemoError, demoDomain } from "./demo-store";
import type { Actor } from "./issue-rules";

const manager: Actor = { name: "John Dlamini", role: "Mine Manager" };
const amina: Actor = { name: "Amina Patel", role: "Shift Supervisor" };
const sipho: Actor = { name: "Sipho Nkosi", role: "Shift Supervisor" };
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

const tomorrow = { name: "Shift A", date: "2025-04-25", start: "06:00", end: "14:00", supervisor: "Amina Patel" };

beforeEach(() => demoDomain.reset());

describe("creating shifts", () => {
  it("schedules a shift with a supervisor and a history entry", () => {
    const shift = demoDomain.createShift(tomorrow, manager);
    expect(shift.state).toBe("scheduled");
    expect(shift.startsAt).toBe("2025-04-25T06:00:00+02:00");
    expect(shift.events[0]).toMatchObject({ type: "created", actor: manager.name });
    expect(demoDomain.listShifts().map((item) => item.id)).toContain(shift.id);
  });

  it("treats a night shift as running into the next day", () => {
    const night = demoDomain.createShift({ name: "Shift C", date: "2025-04-24", start: "22:00", end: "06:00", supervisor: "Sipho Nkosi" }, amina);
    expect(night.endsAt).toBe("2025-04-25T06:00:00+02:00");
  });

  it("rejects bad details with a clear message", () => {
    rejects(() => demoDomain.createShift({ ...tomorrow, name: "ab" }, amina), 400, /name/i);
    rejects(() => demoDomain.createShift({ ...tomorrow, date: "" }, amina), 400, /date/i);
    rejects(() => demoDomain.createShift({ ...tomorrow, start: "06:00", end: "06:30" }, amina), 400, /1 and 16 hours/);
    rejects(() => demoDomain.createShift({ ...tomorrow, supervisor: "Thabo Molefe" }, amina), 400, /supervisor must be/i);
  });

  it("will not let shifts on one site overlap", () => {
    rejects(() => demoDomain.createShift({ ...tomorrow, date: "2025-04-24", start: "12:00", end: "20:00" }, amina), 409, /overlaps Shift A/);
    expect(demoDomain.createShift({ ...tomorrow, date: "2025-04-24", start: "22:00", end: "23:30" }, amina).state).toBe("scheduled");
  });

  it("limits scheduling to management", () => {
    rejects(() => demoDomain.createShift(tomorrow, planner), 403);
    rejects(() => demoDomain.createShift(tomorrow, field), 403);
  });
});

describe("editing, cancelling and deleting", () => {
  it("edits a scheduled shift, and keeps a running shift to briefing, crew and work", () => {
    const shift = demoDomain.createShift(tomorrow, manager);
    const edited = demoDomain.updateShift(shift.id, { name: "Day shift", supervisor: "Sipho Nkosi", briefing: "Heavy rain forecast.", version: shift.version }, amina);
    expect(edited.name).toBe("Day shift");
    expect(edited.supervisor).toBe("Sipho Nkosi");
    expect(edited.events.at(-1)?.summary).toMatch(/name, supervisor, briefing/);
    rejects(() => demoDomain.updateShift(shift.id, { briefing: "Stale edit", version: shift.version }, amina), 409, /changed while/);
    rejects(() => demoDomain.updateShift("shift-a-20250424", { name: "Renamed" }, amina), 409, /running/);
    expect(demoDomain.updateShift("shift-a-20250424", { briefing: "Updated briefing for the day." }, amina).briefing).toMatch(/Updated/);
  });

  it("cancels a scheduled shift with a reason and keeps it read-only", () => {
    const shift = demoDomain.createShift(tomorrow, manager);
    rejects(() => demoDomain.cancelShift(shift.id, {}, manager), 400, /reason/i);
    const cancelled = demoDomain.cancelShift(shift.id, { reason: "Public holiday, no production." }, manager);
    expect(cancelled.state).toBe("cancelled");
    rejects(() => demoDomain.updateShift(shift.id, { briefing: "Edit after cancelling." }, manager), 409, /read-only/);
    rejects(() => demoDomain.cancelShift("shift-a-20250424", { reason: "Cancel a running shift." }, manager), 409, /closed instead/);
  });

  it("deletes only an empty shift made in error", () => {
    const empty = demoDomain.createShift(tomorrow, manager);
    expect(demoDomain.deleteShift(empty.id, manager)).toEqual({ id: empty.id, deleted: true });
    const filled = demoDomain.createShift(tomorrow, manager);
    demoDomain.addCrew(filled.id, { name: "Thabo Molefe", duty: "Operator" }, manager);
    rejects(() => demoDomain.deleteShift(filled.id, manager), 409, /Cancel it instead/);
    rejects(() => demoDomain.deleteShift("shift-a-20250424", manager), 409, /kept as a record/);
  });
});

describe("running a shift", () => {
  it("only starts a shift for its own supervisor or the Mine Manager, one at a time", () => {
    rejects(() => demoDomain.startShift("shift-b-20250424", sipho), 409, /Shift A is still running/);
    rejects(() => demoDomain.startShift("shift-a-20250424", amina), 409, /Only a scheduled shift/);
    const bare = demoDomain.createShift({ ...tomorrow, supervisor: "" }, manager);
    rejects(() => demoDomain.startShift(bare.id, manager), 409, /supervisor/);
  });

  it("will not close a shift with open work until the handover is published", () => {
    rejects(() => demoDomain.closeShift("shift-a-20250424", sipho), 403);
    rejects(() => demoDomain.closeShift("shift-a-20250424", amina), 409, /Publish the handover before closing/);
    demoDomain.publishHandover("shift-a-20250424", amina);
    const closed = demoDomain.closeShift("shift-a-20250424", amina);
    expect(closed.state).toBe("closed");
    expect(closed.events.at(-1)?.note).toMatch(/2 tasks were not finished/);
    rejects(() => demoDomain.updateShift("shift-a-20250424", { briefing: "After close." }, amina), 409, /read-only/);
  });

  it("lets the next shift start once the last one is closed", () => {
    demoDomain.publishHandover("shift-a-20250424", amina);
    demoDomain.closeShift("shift-a-20250424", amina);
    expect(demoDomain.startShift("shift-b-20250424", sipho).state).toBe("in_progress");
  });
});

describe("crew and work", () => {
  it("adds and removes crew, without duplicates or unknown people", () => {
    const shift = demoDomain.shiftView("shift-b-20250424");
    const added = demoDomain.addCrew(shift.id, { name: "Thabo Molefe", duty: "Drill operator", equipmentId: "eq-dz017" }, sipho);
    expect(added.crew[0]).toMatchObject({ name: "Thabo Molefe", equipmentId: "eq-dz017" });
    rejects(() => demoDomain.addCrew(shift.id, { name: "Thabo Molefe", duty: "Operator" }, sipho), 409, /already on this shift/);
    rejects(() => demoDomain.addCrew(shift.id, { name: "Sipho Nkosi", duty: "Operator" }, sipho), 409, /already on this shift/);
    rejects(() => demoDomain.addCrew(shift.id, { name: "Nobody Here", duty: "Operator" }, sipho), 400, /team/);
    rejects(() => demoDomain.addCrew(shift.id, { name: "Lebo Maseko", duty: "Operator", equipmentId: "eq-nope" }, sipho), 400, /active register/);
    rejects(() => demoDomain.addCrew(shift.id, { name: "Lebo Maseko", duty: "Operator" }, planner), 403);
    const removed = demoDomain.removeCrew(shift.id, added.crew[0].id, {}, sipho);
    expect(removed.crew).toHaveLength(0);
  });

  it("attaches open issues as work, once each", () => {
    const shift = demoDomain.shiftView("shift-b-20250424");
    const withIssue = demoDomain.addWork(shift.id, { title: "Chase the spare-part confirmation", issueId: "issue-riv-001", owner: "Naledi Khoza" }, sipho);
    expect(withIssue.work[0].issueId).toBe("issue-riv-001");
    rejects(() => demoDomain.addWork(shift.id, { title: "Same issue again", issueId: "issue-riv-001" }, sipho), 409, /already on this shift/);
    rejects(() => demoDomain.addWork(shift.id, { title: "Missing issue", issueId: "issue-nope" }, sipho), 400, /still open/);
    rejects(() => demoDomain.addWork(shift.id, { title: "ab" }, sipho), 400, /task/i);
  });

  it("lets the person a task is assigned to mark it done, and nobody else outside management", () => {
    const shift = demoDomain.shiftView("shift-a-20250424");
    const task = shift.work.find((item) => item.owner === "Naledi Khoza")!;
    const done = demoDomain.updateWork(shift.id, task.id, { done: true }, stores);
    expect(done.work.find((item) => item.id === task.id)?.done).toBe(true);
    rejects(() => demoDomain.updateWork(shift.id, task.id, { done: false }, field), 403);
    rejects(() => demoDomain.updateWork(shift.id, task.id, { title: "Retitled by the owner" }, stores), 403);
    expect(demoDomain.updateWork(shift.id, task.id, { done: false }, amina).work.find((item) => item.id === task.id)?.done).toBe(false);
  });

  it("keeps a completion note and up to five evidence files with the task, and clears them when it is reopened", () => {
    const shift = demoDomain.shiftView("shift-a-20250424");
    const task = shift.work.find((item) => item.owner === "Naledi Khoza")!;
    const files = Array.from({ length: 7 }, (_, index) => ({ name: `photo-${index}.jpg`, kind: "photo", sizeLabel: "1.2 MB" }));
    const done = demoDomain.updateWork(shift.id, task.id, { done: true, note: "Counted the liners on the shelf.", evidence: [...files, { name: "  ", kind: "photo", sizeLabel: "1 KB" }] }, stores);
    const finished = done.work.find((item) => item.id === task.id)!;
    expect(finished.completion).toMatchObject({ note: "Counted the liners on the shelf.", by: "Naledi Khoza" });
    expect(finished.completion?.evidence).toHaveLength(5);
    expect(done.events.at(-1)).toMatchObject({ type: "work_updated", note: "Counted the liners on the shelf." });
    expect(done.events.at(-1)?.summary).toMatch(/5 files/);
    const reopened = demoDomain.updateWork(shift.id, task.id, { done: false }, amina);
    expect(reopened.work.find((item) => item.id === task.id)?.completion).toBeNull();
  });

  it("takes a task done with no note or evidence, because both are optional", () => {
    const shift = demoDomain.shiftView("shift-a-20250424");
    const task = shift.work.find((item) => item.owner === "Naledi Khoza")!;
    const done = demoDomain.updateWork(shift.id, task.id, { done: true }, stores);
    expect(done.work.find((item) => item.id === task.id)?.completion).toEqual({ note: null, evidence: [], by: "Naledi Khoza" });
  });

  it("removes a task with a history entry", () => {
    const shift = demoDomain.shiftView("shift-a-20250424");
    const after = demoDomain.removeWork(shift.id, shift.work[0].id, {}, amina);
    expect(after.work).toHaveLength(shift.work.length - 1);
    expect(after.events.at(-1)?.type).toBe("work_removed");
  });
});

describe("handover between real shifts", () => {
  it("knows the next and previous shifts and what carries forward", () => {
    const a = demoDomain.shiftView("shift-a-20250424");
    expect(a.previous?.name).toBe("Shift C");
    expect(a.next).toMatchObject({ name: "Shift B", supervisor: "Sipho Nkosi" });
    expect(a.unresolved).toBe(3);
  });

  it("lets the next shift's supervisor acknowledge, but not the outgoing supervisor", () => {
    demoDomain.publishHandover("shift-a-20250424", amina);
    rejects(() => demoDomain.acknowledgeHandover("shift-a-20250424", amina), 403, /incoming/);
    rejects(() => demoDomain.acknowledgeHandover("shift-a-20250424", stores), 403);
    const acknowledged = demoDomain.acknowledgeHandover("shift-a-20250424", sipho);
    expect(acknowledged.handover).toMatchObject({ state: "acknowledged", acknowledgedBy: "Sipho Nkosi" });
    expect(acknowledged.events.at(-1)?.type).toBe("handover_acknowledged");
    expect(demoDomain.getIssue("issue-riv-001").workflowState).toBe("awaiting_dependency");
  });

  it("needs the shift to have started before a handover is published", () => {
    rejects(() => demoDomain.publishHandover("shift-b-20250424", sipho), 409, /started/);
  });

  it("keeps cancelled shifts out of the chain", () => {
    const shift = demoDomain.createShift({ name: "Shift X", date: "2025-04-24", start: "22:00", end: "23:30", supervisor: "Amina Patel" }, manager);
    demoDomain.cancelShift(shift.id, { reason: "Not needed after all." }, manager);
    expect(demoDomain.shiftView("shift-b-20250424").next).toBeNull();
  });
});
