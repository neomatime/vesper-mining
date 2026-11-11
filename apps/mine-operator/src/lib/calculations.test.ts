import { describe, expect, it } from "vitest";
import type { Action } from "@vesper/api-contracts";
import { deriveAreaStatus, potentiallyAllocable, recoverySummary } from "./calculations";

const actions: Action[] = [
  { id: "1", title: "One", owner: "A", team: "Ops", state: "complete", dueAt: null },
  { id: "2", title: "Two", owner: "B", team: "Ops", state: "complete", dueAt: null },
  { id: "3", title: "Three", owner: "C", team: "Ops", state: "in_progress", dueAt: null },
  { id: "4", title: "Four", owner: "D", team: "Ops", state: "pending", dueAt: null },
  { id: "5", title: "Five", owner: "E", team: "Ops", state: "pending", dueAt: null },
];

describe("recoverySummary", () => {
  it("keeps complete, active and pending work separate", () => {
    expect(recoverySummary(actions)).toBe("2 complete · 1 in progress · 2 pending");
  });
});

describe("potentiallyAllocable", () => {
  it("does not turn unknown stock into zero", () => {
    expect(potentiallyAllocable(null, null)).toBeNull();
  });

  it("subtracts reserved stock without returning a negative value", () => {
    expect(potentiallyAllocable(5, 2)).toBe(3);
    expect(potentiallyAllocable(1, 4)).toBe(0);
  });
});

describe("deriveAreaStatus", () => {
  it("does not turn a reported blocker into confirmed red", () => {
    expect(deriveAreaStatus({ quality: "reported", verifiedBlocker: true, credibleRisk: true, onPlanEvidence: false })).toBe("at_risk");
  });

  it("makes stale evidence unknown even when the previous state was on plan", () => {
    expect(deriveAreaStatus({ quality: "stale", verifiedBlocker: false, credibleRisk: false, onPlanEvidence: true })).toBe("unknown");
  });

  it("requires verified evidence for a blocked status", () => {
    expect(deriveAreaStatus({ quality: "verified", verifiedBlocker: true, credibleRisk: true, onPlanEvidence: false })).toBe("blocked");
  });
});
