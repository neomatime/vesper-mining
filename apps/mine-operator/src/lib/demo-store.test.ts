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

function newIssue() {
  return demoDomain.createIssue(
    { title: "Hydraulic leak on EX-204", description: "A hydraulic leak was observed during pre-start." },
    field,
  );
}

/** Moves a fresh issue to in_progress, owned by the planner. */
function startedIssue() {
  const created = newIssue();
  demoDomain.transitionIssue(created.id, { to: "reviewed" }, supervisor);
  demoDomain.updateIssue(created.id, { owner: planner.name }, supervisor);
  demoDomain.addAction(created.id, { title: "Inspect and repair hose", owner: planner.name, team: "Maintenance", dueAt: "2025-04-24T16:00:00+02:00" }, supervisor);
  demoDomain.transitionIssue(created.id, { to: "action_assigned" }, supervisor);
  return demoDomain.transitionIssue(created.id, { to: "in_progress" }, planner);
}

beforeEach(() => {
  demoDomain.reset();
});

describe("issue lifecycle", () => {
  it("records the reporter and an append-only event history", () => {
    const issue = newIssue();
    expect(issue.workflowState).toBe("reported");
    expect(issue.events).toHaveLength(1);
    expect(issue.events[0]).toMatchObject({ type: "reported", actor: field.name, nextState: "reported" });
  });

  it("rejects invalid input with a clear message", () => {
    rejects(() => demoDomain.createIssue({ title: "ab", description: "short" }, field), 400, /title/i);
  });

  it("requires a primary cause with equipment, and offers only the secondary causes that belong to it", () => {
    const base = { title: "Hydraulic leak on EX-204", description: "A hydraulic leak was observed during pre-start.", equipmentId: "eq-ex204" };
    const issue = demoDomain.createIssue({ ...base, defect: { symptom: "hydraulic", secondary: "hose_or_fitting_leak", operability: "limited" } }, field);
    expect(issue.defect).toEqual({ symptom: "hydraulic", secondary: "hose_or_fitting_leak", operability: "limited" });
    expect(demoDomain.createIssue({ ...base, defect: { symptom: "hydraulic", operability: "unsure" } }, field).defect).toEqual({ symptom: "hydraulic", secondary: null, operability: "unsure" });
    expect(demoDomain.createIssue({ ...base, defect: { symptom: "other", operability: "unsure" } }, field).defect?.secondary).toBeNull();
    rejects(() => demoDomain.createIssue(base, field), 400, /primary cause/i);
    // A secondary cause from another primary cause's list is refused.
    rejects(() => demoDomain.createIssue({ ...base, defect: { symptom: "hydraulic", secondary: "feed_blockage", operability: "limited" } }, field), 400, /does not belong to the primary cause/i);
    rejects(() => demoDomain.createIssue({ ...base, defect: { symptom: "other", secondary: "weather", operability: "limited" } }, field), 400, /does not belong/i);
    rejects(() => demoDomain.createIssue({ ...base, defect: { symptom: "mystery", operability: "limited" } }, field), 400, /from the lists/i);
    rejects(() => demoDomain.createIssue({ ...base, defect: { symptom: "hydraulic", operability: "fine" } }, field), 400, /from the lists/i);
    rejects(() => demoDomain.createIssue({ title: base.title, description: base.description, defect: { symptom: "hydraulic", operability: "limited" } }, field), 400, /equipment is selected/i);
    expect(demoDomain.createIssue({ title: base.title, description: base.description }, field).defect).toBeNull();
  });

  it("walks the contract path and keeps verification independent", () => {
    const started = startedIssue();
    expect(started.workflowState).toBe("in_progress");

    const reported = demoDomain.transitionIssue(started.id, { to: "resolution_reported", note: "Replaced the hose and tested at pressure" }, planner);
    expect(reported.resolutionReportedBy).toBe(planner.name);
    expect(reported.quality).toBe("reported");

    rejects(() => demoDomain.transitionIssue(started.id, { to: "verified", note: "Checked the repair on site" }, planner), 403);
    const verified = demoDomain.transitionIssue(started.id, { to: "verified", note: "Inspected the hose and pressure test log" }, supervisor);
    expect(verified.quality).toBe("verified");
    expect(verified.verifications).toHaveLength(1);

    rejects(() => demoDomain.transitionIssue(started.id, { to: "closed" }, supervisor), 409, /remaining actions/);
    const actionId = verified.actions[0].id;
    demoDomain.updateAction(started.id, actionId, { state: "complete" }, planner);
    const closed = demoDomain.transitionIssue(started.id, { to: "closed" }, supervisor);
    expect(closed.workflowState).toBe("closed");
  });

  it("keeps closed issues read-only until a Mine Manager reopens them", () => {
    const started = startedIssue();
    demoDomain.updateAction(started.id, started.actions[0].id, { state: "complete" }, planner);
    demoDomain.transitionIssue(started.id, { to: "resolution_reported", note: "Replaced the hose and tested" }, planner);
    demoDomain.transitionIssue(started.id, { to: "verified", note: "Inspected on site with the planner" }, supervisor);
    demoDomain.transitionIssue(started.id, { to: "closed" }, supervisor);

    rejects(() => demoDomain.updateIssue(started.id, { title: "Changed after closing" }, supervisor), 409, /read-only/i);
    rejects(() => demoDomain.transitionIssue(started.id, { to: "reopened", note: "New leak at the same fitting" }, supervisor), 403, /Mine Manager/);
    const reopened = demoDomain.transitionIssue(started.id, { to: "reopened", note: "New leak at the same fitting" }, manager);
    expect(reopened.workflowState).toBe("reopened");
    expect(reopened.quality).toBe("reported");
    expect(reopened.events.at(-1)?.note).toMatch(/same fitting/);
  });

  it("returns a rejected verification to a non-closed state and tells the people involved", () => {
    const started = startedIssue();
    demoDomain.transitionIssue(started.id, { to: "resolution_reported", note: "Replaced the hose and tested" }, planner);
    const rejected = demoDomain.transitionIssue(started.id, { to: "reopened", note: "Pressure test log is missing" }, supervisor);
    expect(rejected.workflowState).toBe("reopened");
    expect(rejected.verifications.at(-1)?.result).toBe("rejected");
    expect(demoDomain.listNotifications(planner).some((item) => item.title === "Resolution was not verified")).toBe(true);
  });

  it("allows only the contract's cancel and duplicate outcomes, and preserves history", () => {
    const issue = newIssue();
    rejects(() => demoDomain.transitionIssue(issue.id, { to: "duplicate", note: "Already reported earlier" }, supervisor), 409, /issue number/i);
    const duplicate = demoDomain.transitionIssue(issue.id, { to: "duplicate", note: "Already reported earlier", reference: "RIV-2025-039" }, supervisor);
    expect(duplicate.workflowState).toBe("duplicate");
    expect(duplicate.events.length).toBeGreaterThan(1);
    expect(demoDomain.listIssues().some((item) => item.id === issue.id)).toBe(true);
  });

  it("blocks steps a role should not take", () => {
    const issue = newIssue();
    rejects(() => demoDomain.transitionIssue(issue.id, { to: "reviewed" }, field), 403);
    rejects(() => demoDomain.updateIssue(issue.id, { title: "Field edit attempt" }, field), 403);
  });

  it("detects conflicting edits with the issue version", () => {
    const issue = newIssue();
    const stale = issue.version;
    demoDomain.updateIssue(issue.id, { priority: "high", version: stale }, supervisor);
    rejects(() => demoDomain.updateIssue(issue.id, { title: "Another edit from a stale page", version: stale }, supervisor), 409, /changed/);
  });

  it("logs owner and priority changes separately", () => {
    const issue = newIssue();
    const updated = demoDomain.updateIssue(issue.id, { owner: planner.name, priority: "critical" }, supervisor);
    const types = updated.events.map((event) => event.type);
    expect(types).toContain("owner_changed");
    expect(types).toContain("priority_changed");
  });
});

describe("actions and dependencies", () => {
  it("removes an action softly, and can restore it", () => {
    const started = startedIssue();
    const actionId = started.actions[0].id;
    const removed = demoDomain.removeAction(started.id, actionId, {}, supervisor);
    expect(removed.actions[0].removedAt).not.toBeNull();
    const restored = demoDomain.restoreAction(started.id, actionId, supervisor);
    expect(restored.actions[0].removedAt).toBeNull();
    expect(restored.events.map((event) => event.type)).toEqual(expect.arrayContaining(["action_removed", "action_restored"]));
  });

  it("keeps completed actions on the record", () => {
    const started = startedIssue();
    const actionId = started.actions[0].id;
    demoDomain.updateAction(started.id, actionId, { state: "complete" }, planner);
    rejects(() => demoDomain.removeAction(started.id, actionId, {}, supervisor), 409, /stay on the record/);
  });

  it("does not let completing an action resolve the parent issue", () => {
    const started = startedIssue();
    const after = demoDomain.updateAction(started.id, started.actions[0].id, { state: "complete" }, planner);
    expect(after.workflowState).toBe("in_progress");
  });

  it("requires a deadline and justification on dependencies", () => {
    const started = startedIssue();
    rejects(() => demoDomain.addDependency(started.id, { reason: "Waiting for a hose assembly", kind: "parts", owner: stores.name }, planner), 400, /deadline/);
    const waiting = demoDomain.addDependency(
      started.id,
      { reason: "Waiting for a hose assembly", kind: "parts", owner: stores.name, reviewBy: "2025-04-24T14:00:00+02:00" },
      planner,
    );
    const dependency = waiting.dependencies[0];
    expect(demoDomain.listNotifications(stores).some((item) => item.category === "Dependency")).toBe(true);

    const blocked = demoDomain.transitionIssue(started.id, { to: "awaiting_dependency", note: "Waiting for the hose assembly" }, planner);
    expect(blocked.workflowState).toBe("awaiting_dependency");
    rejects(() => demoDomain.transitionIssue(started.id, { to: "in_progress" }, planner), 409, /open dependency/);
    rejects(() => demoDomain.updateDependency(started.id, dependency.id, { state: "bypassed" }, planner), 400, /justification/);
    demoDomain.updateDependency(started.id, dependency.id, { state: "bypassed", resolutionNote: "Used a spare assembly from the workshop" }, planner);
    expect(demoDomain.transitionIssue(started.id, { to: "in_progress" }, planner).workflowState).toBe("in_progress");
  });

  it("adds notes and evidence for any role without changing the state", () => {
    const issue = newIssue();
    const after = demoDomain.addComment(
      issue.id,
      { body: "Leak photographed at the fitting", attachments: [{ id: "x", name: "leak.jpg", kind: "photo", sizeLabel: "1.2 MB" }] },
      field,
    );
    expect(after.comments[0].attachments[0].name).toBe("leak.jpg");
    expect(after.workflowState).toBe("reported");
  });
});

describe("readiness", () => {
  it("never treats unknown stock as zero and never verifies by default", () => {
    const activity = demoDomain.updatePart(
      "readiness-ex204-1000h",
      "part-engine-oil-204",
      { onHand: null, reserved: null, inbound: 1, leadTimeDays: 7, sourceNote: "Stores system not yet reachable" },
      stores,
    );
    const part = activity.parts.find((item) => item.id === "part-engine-oil-204");
    expect(part?.onHand).toBeNull();
    expect(part?.quality).toBe("unknown");
  });

  it("records reported figures, derives status, and limits verification to Stores", () => {
    const input = { onHand: 3, reserved: 0, inbound: 0, leadTimeDays: 14, sourceNote: "Counted in the stores bay" };
    rejects(() => demoDomain.updatePart("readiness-ex204-1000h", "part-hyd-filter-204", { ...input, confirmation: "verified" }, planner), 403);
    const reported = demoDomain.updatePart("readiness-ex204-1000h", "part-hyd-filter-204", input, planner);
    expect(reported.parts[0].quality).toBe("reported");
    expect(reported.status).toBe("needs_confirmation");
    const verified = demoDomain.updatePart("readiness-ex204-1000h", "part-hyd-filter-204", { ...input, confirmation: "verified" }, stores);
    expect(verified.parts[0].quality).toBe("verified");
  });

  it("requires both stock figures together", () => {
    rejects(() => demoDomain.updatePart("readiness-ex204-1000h", "part-hyd-filter-204", { onHand: 2, reserved: null, sourceNote: "Counted in the stores bay" }, stores), 400, /together/);
  });

  it("records a review without approving a purchase, and escalates to the manager", () => {
    rejects(() => demoDomain.addReview("readiness-ex204-1000h", { decision: "purchase_review", note: "Start a purchasing review" }, field), 403);
    const reviewed = demoDomain.addReview("readiness-ex204-1000h", { decision: "escalate", note: "Filter kit may miss the service date" }, planner);
    expect(reviewed.reviewState).toBe("reviewed");
    expect(reviewed.reviews).toHaveLength(1);
    expect(demoDomain.listNotifications(manager).some((item) => item.category === "Readiness")).toBe(true);
  });
});

describe("handover", () => {
  const shift = "shift-a-20250424";

  it("carries open issues and open dependencies forward", () => {
    const view = demoDomain.shiftView(shift);
    expect(view.unresolved).toBe(3);
    expect(view.issues.map((issue) => issue.id)).toEqual(["issue-riv-001", "issue-riv-002"]);
  });

  it("needs notes before publishing, and only the incoming supervisor acknowledges", () => {
    demoDomain.saveHandoverNotes(shift, "", supervisor);
    rejects(() => demoDomain.publishHandover(shift, supervisor), 400, /twenty/);
    demoDomain.saveHandoverNotes(shift, "Crusher C-02 is still awaiting spare-part confirmation.", supervisor);
    rejects(() => demoDomain.acknowledgeHandover(shift, manager), 409, /publish/);
    demoDomain.publishHandover(shift, supervisor);
    rejects(() => demoDomain.saveHandoverNotes(shift, "Late edit", supervisor), 409);
    rejects(() => demoDomain.acknowledgeHandover(shift, supervisor), 403, /incoming/);
    expect(demoDomain.acknowledgeHandover(shift, manager).handover.state).toBe("acknowledged");
  });

  it("does not close the underlying issues on acknowledgement", () => {
    demoDomain.publishHandover(shift, supervisor);
    demoDomain.acknowledgeHandover(shift, manager);
    expect(demoDomain.getIssue("issue-riv-001").workflowState).toBe("awaiting_dependency");
  });

  it("can withdraw a published handover before it is acknowledged", () => {
    demoDomain.publishHandover(shift, supervisor);
    expect(demoDomain.withdrawHandover(shift, supervisor).handover.state).toBe("draft");
  });

  it("keeps a field employee out of handover", () => {
    rejects(() => demoDomain.saveHandoverNotes(shift, "Not allowed", field), 403);
  });
});

describe("notifications", () => {
  it("scopes notices to their recipient, supports read, unread and dismiss", () => {
    const issue = newIssue();
    demoDomain.updateIssue(issue.id, { owner: planner.name }, supervisor);
    const mine = demoDomain.listNotifications(planner);
    const assignment = mine.find((item) => item.category === "Assignment");
    expect(assignment).toBeDefined();
    expect(demoDomain.listNotifications(stores).some((item) => item.category === "Assignment")).toBe(false);

    demoDomain.updateNotification(assignment!.id, { read: true });
    expect(demoDomain.listNotifications(planner).find((item) => item.id === assignment!.id)?.unread).toBe(false);
    demoDomain.updateNotification(assignment!.id, { read: false });
    expect(demoDomain.listNotifications(planner).find((item) => item.id === assignment!.id)?.unread).toBe(true);
    demoDomain.updateNotification(assignment!.id, { dismissed: true });
    expect(demoDomain.listNotifications(planner).some((item) => item.id === assignment!.id)).toBe(false);
  });

  it("marks everything read for one recipient", () => {
    expect(demoDomain.readAllNotifications(manager).every((item) => !item.unread)).toBe(true);
  });
});

describe("reset", () => {
  it("restores every fictional record to its starting state", () => {
    newIssue();
    demoDomain.reset();
    expect(demoDomain.listIssues()).toHaveLength(2);
  });
});
