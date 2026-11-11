import { describe, expect, it } from "vitest";
import type { OperationalIssue } from "@vesper/api-contracts";
import {
  canAct,
  checkTransition,
  effectiveActionState,
  isOpen,
  railPosition,
  transitionOptions,
  type Actor,
} from "./issue-rules";

const manager: Actor = { name: "John Dlamini", role: "Mine Manager" };
const supervisor: Actor = { name: "Amina Patel", role: "Shift Supervisor" };
const field: Actor = { name: "Thabo Molefe", role: "Field Employee" };

function issue(overrides: Partial<OperationalIssue> = {}): OperationalIssue {
  return {
    id: "i1",
    organisationId: "o",
    siteId: "s",
    issueNumber: "RIV-1",
    title: "Title",
    description: "Description",
    equipmentId: null,
    areaId: null,
    priority: "medium",
    workflowState: "reported",
    quality: "reported",
    operationalStatus: "at_risk",
    owner: null,
    reportedAt: "2025-04-24T08:00:00+02:00",
    updatedAt: "2025-04-24T08:00:00+02:00",
    source: { label: "x", observedAt: "2025-04-24T08:00:00+02:00", quality: "reported" },
    actions: [],
    version: 1,
    resolutionReportedBy: null,
    dependencies: [],
    comments: [],
    verifications: [],
    events: [],
    ...overrides,
  };
}

const action = (overrides = {}) => ({
  id: "a1",
  title: "Do it",
  owner: "Lebo Maseko",
  team: "Maintenance",
  state: "pending" as const,
  dueAt: "2025-04-24T12:00:00+02:00",
  completedAt: null,
  removedAt: null,
  ...overrides,
});

const dependency = (state: "open" | "resolved" | "bypassed" = "open") => ({
  id: "d1",
  reason: "Waiting for a part",
  kind: "parts" as const,
  blockedActionId: null,
  owner: "Naledi Khoza",
  state,
  raisedAt: "2025-04-24T08:00:00+02:00",
  reviewBy: "2025-04-24T12:00:00+02:00",
  resolutionNote: null,
});

describe("permissions", () => {
  it("lets coordinators review and keeps field employees to commenting", () => {
    expect(canAct("review", supervisor).allowed).toBe(true);
    expect(canAct("review", field).allowed).toBe(false);
    expect(canAct("comment", field).allowed).toBe(true);
  });

  it("lets an owner move their own work without a coordinator role", () => {
    const owned = issue({ owner: field.name });
    expect(canAct("progress", field, owned).allowed).toBe(true);
    expect(canAct("progress", field, issue()).allowed).toBe(false);
  });
});

describe("transitions", () => {
  it("follows the contract from reported", () => {
    const options = transitionOptions(issue(), manager).map((option) => option.to);
    expect(options).toEqual(["reviewed", "duplicate", "cancelled"]);
  });

  it("requires an owner and an action with an owner and deadline before assignment", () => {
    const reviewed = issue({ workflowState: "reviewed" });
    expect(checkTransition(reviewed, "action_assigned", {}, manager)).toMatch(/owner/i);
    const noDeadline = issue({ workflowState: "reviewed", owner: "Lebo Maseko", actions: [action({ dueAt: null })] });
    expect(checkTransition(noDeadline, "action_assigned", {}, manager)).toMatch(/deadline/i);
    const ready = issue({ workflowState: "reviewed", owner: "Lebo Maseko", actions: [action()] });
    expect(checkTransition(ready, "action_assigned", {}, manager)).toBeNull();
  });

  it("ignores removed actions when checking assignment", () => {
    const removed = issue({ workflowState: "reviewed", owner: "Lebo Maseko", actions: [action({ removedAt: "2025-04-24T09:00:00+02:00" })] });
    expect(checkTransition(removed, "action_assigned", {}, manager)).toMatch(/deadline/i);
  });

  it("needs an open dependency to wait, and none open to resume or report", () => {
    const working = issue({ workflowState: "in_progress" });
    expect(checkTransition(working, "awaiting_dependency", { note: "Waiting for filter kit" }, manager)).toMatch(/dependency/i);
    const waiting = issue({ workflowState: "awaiting_dependency", dependencies: [dependency("open")] });
    expect(checkTransition(waiting, "in_progress", {}, manager)).toMatch(/open dependency/i);
    expect(checkTransition(waiting, "resolution_reported", { note: "Repaired and tested" }, manager)).toMatch(/open dependency/i);
    const cleared = issue({ workflowState: "awaiting_dependency", dependencies: [dependency("resolved")] });
    expect(checkTransition(cleared, "in_progress", {}, manager)).toBeNull();
  });

  it("requires a meaningful note where the step asks for one", () => {
    const working = issue({ workflowState: "in_progress" });
    expect(checkTransition(working, "resolution_reported", { note: "done" }, manager)).toMatch(/note/i);
    expect(checkTransition(working, "resolution_reported", { note: "Replaced the feeder liner and tested" }, manager)).toBeNull();
  });

  it("requires independent verification", () => {
    const reported = issue({ workflowState: "resolution_reported", resolutionReportedBy: supervisor.name });
    expect(checkTransition(reported, "verified", { note: "Inspected on site" }, supervisor)).toMatch(/someone other/i);
    expect(checkTransition(reported, "verified", { note: "Inspected on site" }, manager)).toBeNull();
    expect(checkTransition(reported, "reopened", { note: "Liner still worn" }, manager)).toBeNull();
  });

  it("does not let a repair close the issue", () => {
    const verified = issue({ workflowState: "verified", actions: [action({ state: "in_progress" })] });
    expect(checkTransition(verified, "closed", {}, manager)).toMatch(/remaining actions/i);
    const done = issue({ workflowState: "verified", actions: [action({ state: "complete" })] });
    expect(checkTransition(done, "closed", {}, manager)).toBeNull();
  });

  it("makes reopening a closed issue a Mine Manager step", () => {
    const closed = issue({ workflowState: "closed" });
    expect(checkTransition(closed, "reopened", { note: "New evidence of leak" }, supervisor)).toMatch(/Mine Manager/);
    expect(checkTransition(closed, "reopened", { note: "New evidence of leak" }, manager)).toBeNull();
  });

  it("treats cancelled and duplicate as terminal, and duplicate needs a reference", () => {
    expect(transitionOptions(issue({ workflowState: "cancelled" }), manager)).toEqual([]);
    expect(checkTransition(issue(), "duplicate", { note: "Already reported earlier" }, manager)).toMatch(/issue number/i);
    expect(checkTransition(issue(), "duplicate", { note: "Already reported earlier", reference: "RIV-2025-039" }, manager)).toBeNull();
  });

  it("rejects transitions outside the contract", () => {
    expect(checkTransition(issue(), "closed", {}, manager)).toMatch(/cannot move/);
  });
});

describe("helpers", () => {
  it("reads an unfinished past-deadline action as overdue", () => {
    const now = "2025-04-24T13:00:00+02:00";
    expect(effectiveActionState(action(), now)).toBe("overdue");
    expect(effectiveActionState(action({ state: "complete" }), now)).toBe("complete");
    expect(effectiveActionState(action({ dueAt: null }), now)).toBe("pending");
  });

  it("knows which issues are open coordination", () => {
    expect(isOpen(issue())).toBe(true);
    expect(isOpen(issue({ workflowState: "verified" }))).toBe(false);
    expect(isOpen(issue({ workflowState: "duplicate" }))).toBe(false);
  });

  it("places waiting and reopened issues on the rail", () => {
    expect(railPosition("awaiting_dependency")).toBe(railPosition("in_progress"));
    expect(railPosition("reopened")).toBe(railPosition("reviewed"));
    expect(railPosition("cancelled")).toBe(-1);
  });
});
