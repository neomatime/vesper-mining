import { describe, expect, it } from "vitest";
import type { OperationalIssue, ReadinessActivity } from "@vesper/api-contracts";
import { needsAttention } from "./needs-attention";

const now = "2025-04-24T08:47:00+02:00";

const issue = (id: string, priority: OperationalIssue["priority"], extra: Partial<OperationalIssue> = {}) =>
  ({
    id,
    title: `Issue ${id}`,
    priority,
    workflowState: "in_progress",
    operationalStatus: "at_risk",
    owner: "Lebo Maseko",
    reportedAt: "2025-04-24T08:05:00+02:00",
    ...extra,
  }) as OperationalIssue;

const activity = (id: string, status: ReadinessActivity["status"]) => ({ id, title: `Activity ${id}`, equipmentId: "eq-1", status }) as ReadinessActivity;

const empty = { issues: [], readiness: [], equipment: [], shifts: [], now };

describe("needs attention", () => {
  it("puts a critical blocked issue ahead of a medium one and a readiness risk", () => {
    const list = needsAttention({
      ...empty,
      issues: [issue("a", "medium"), issue("b", "critical", { operationalStatus: "blocked" })],
      readiness: [activity("r", "needs_confirmation")],
    });
    expect(list.map((item) => item.id)).toEqual(["issue-b", "readiness-r", "issue-a"]);
  });

  it("leaves out finished issues and the one already shown elsewhere", () => {
    const list = needsAttention(
      { ...empty, issues: [issue("a", "high"), issue("b", "high", { workflowState: "closed" }), issue("c", "high")] },
      { issueId: "c" },
    );
    expect(list.map((item) => item.id)).toEqual(["issue-a"]);
  });

  it("asks for an owner when an issue has none, and ranks it a little higher", () => {
    const [first] = needsAttention({ ...empty, issues: [issue("a", "high", { owner: null }), issue("b", "high")] });
    expect(first?.id).toBe("issue-a");
    expect(first?.action).toBe("Assign an owner");
  });

  it("skips ready stock and equipment that is not due", () => {
    const list = needsAttention({
      ...empty,
      readiness: [activity("r", "ready")],
      equipment: [{ id: "e", code: "EX-1", name: "Excavator", nextService: { state: "ok", name: "250 h", label: "Due in 40 days" } as never }],
    });
    expect(list).toEqual([]);
  });

  it("lists overdue service above due-soon service", () => {
    const list = needsAttention({
      ...empty,
      equipment: [
        { id: "e1", code: "EX-1", name: "Excavator", nextService: { state: "due_soon", name: "250 h", label: "Due in 12 days" } as never },
        { id: "e2", code: "HT-2", name: "Truck", nextService: { state: "overdue", name: "500 h", label: "Overdue by 2 days" } as never },
      ],
    });
    expect(list.map((item) => item.id)).toEqual(["service-e2", "service-e1"]);
  });

  it("flags an unpublished handover more strongly when the shift is about to end", () => {
    const soon = needsAttention({ ...empty, shifts: [{ id: "s", name: "Shift A", state: "in_progress", endsAt: "2025-04-24T10:00:00+02:00", handover: { state: "draft" } as never }] });
    const later = needsAttention({ ...empty, shifts: [{ id: "s", name: "Shift A", state: "in_progress", endsAt: "2025-04-24T14:00:00+02:00", handover: { state: "draft" } as never }] });
    expect(soon[0]?.urgency).toBeGreaterThan(later[0]?.urgency ?? 0);
    expect(soon[0]?.reason).toContain("1 h 13 min");
    expect(needsAttention({ ...empty, shifts: [{ id: "s", name: "Shift A", state: "in_progress", endsAt: "2025-04-24T10:00:00+02:00", handover: { state: "published" } as never }] })).toEqual([]);
  });
});
