// @vitest-environment node

/**
 * Unit tests (Vitest). Reviewing and approving the generated shift briefing: a supervisor corrects lines and adds a note, approves, and can
 * reopen; only permitted roles may; approval never sends the handover or changes another record; a change in the records after approval is
 * flagged; and the history keeps every step.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoError, demoDomain } from "./demo-store";
import type { Actor } from "./issue-rules";

const supervisor: Actor = { name: "Amina Patel", role: "Shift Supervisor" };
const manager: Actor = { name: "John Dlamini", role: "Mine Manager" };
const planner: Actor = { name: "Lebo Maseko", role: "Maintenance Planner" };
const stores: Actor = { name: "Naledi Khoza", role: "Stores / Inventory Controller" };

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

beforeEach(() => demoDomain.reset());

describe("reviewing the generated briefing", () => {
  it("starts as an unreviewed draft, generated from records, and reading it changes nothing", () => {
    const view = demoDomain.briefing(supervisor);
    expect(view.record.state).toBe("draft");
    expect(view.record.approvedBy).toBeNull();
    expect(view.lines.every((line) => !line.edited)).toBe(true);
    expect(view.canReview).toBe(true);
    expect(demoDomain.briefing(planner).canReview).toBe(false);
    expect(demoDomain.get().briefings).toHaveLength(0);
  });

  it("keeps a supervisor's corrections and note as a draft, marking corrected lines and leaving the generated text alone", () => {
    const view = demoDomain.saveBriefing({ corrections: { production: "Production: 156,200 t reported. The weighbridge check is due this afternoon." }, note: "Watch the crusher feed." }, supervisor);
    expect(view.record.state).toBe("draft");
    const line = view.lines.find((item) => item.id === "production")!;
    expect(line).toMatchObject({ edited: true, text: "Production: 156,200 t reported. The weighbridge check is due this afternoon." });
    expect(line.generated).toMatch(/96% of the 162,000 t target/);
    expect(view.record.note).toBe("Watch the crusher feed.");
    expect(view.record.history.at(-1)!.summary).toBe("Corrections saved as a draft");
  });

  it("refuses empty, over-long and unchanged corrections without recording them", () => {
    rejects(() => demoDomain.saveBriefing({ corrections: { production: "   " } }, supervisor), 400, /cannot be empty/);
    rejects(() => demoDomain.saveBriefing({ corrections: { production: "x".repeat(301) } }, supervisor), 400, /300 characters/);
    const generated = demoDomain.briefing(supervisor).lines.find((line) => line.id === "production")!.generated;
    const view = demoDomain.saveBriefing({ corrections: { production: generated, "not-a-line": "ignored" } }, supervisor);
    expect(view.lines.every((line) => !line.edited)).toBe(true);
    expect(Object.keys(view.record.corrections)).toEqual([]);
  });

  it("is reviewed only by a Shift Supervisor or the Mine Manager", () => {
    rejects(() => demoDomain.saveBriefing({}, planner), 403, /Shift Supervisor or the Mine Manager/);
    rejects(() => demoDomain.approveBriefing({}, stores), 403);
    rejects(() => demoDomain.reopenBriefing({ reason: "Trying it." }, planner), 403);
    expect(demoDomain.approveBriefing({}, manager).record.state).toBe("approved");
  });
});

describe("approving", () => {
  it("is attributed, keeps the corrections, notifies, and does not send the handover or change any record", () => {
    const before = demoDomain.listShifts().find((item) => item.id === demoDomain.briefing(supervisor).shiftId)!;
    const issuesBefore = JSON.stringify(demoDomain.listIssues());
    const view = demoDomain.approveBriefing({ corrections: { handover: "The handover is a draft; I will send it before 13:30." }, note: "Crusher first." }, supervisor);
    expect(view.record).toMatchObject({ state: "approved", approvedBy: "Amina Patel", note: "Crusher first." });
    expect(view.record.approvedAt).not.toBeNull();
    expect(view.record.history.at(-1)!.summary).toBe("Approved with 1 correction");
    expect(view.lines.find((line) => line.id === "handover")!.edited).toBe(true);
    // Approval does not publish the handover or touch another record.
    const after = demoDomain.listShifts().find((item) => item.id === view.shiftId)!;
    expect(after.handover.state).toBe(before.handover.state);
    expect(JSON.stringify(demoDomain.listIssues())).toBe(issuesBefore);
    expect(demoDomain.get().notifications.some((item) => item.title === "Shift briefing approved")).toBe(true);
  });

  it("approves as generated when nothing is corrected, and then cannot be changed until it is reopened", () => {
    const view = demoDomain.approveBriefing({}, supervisor);
    expect(view.record.history.at(-1)!.summary).toBe("Approved as generated");
    rejects(() => demoDomain.saveBriefing({ note: "One more thing." }, supervisor), 409, /Reopen it/);
    rejects(() => demoDomain.approveBriefing({}, manager), 409, /Reopen it/);
  });

  it("notices when the records change after approval and says which lines no longer match", () => {
    demoDomain.approveBriefing({}, supervisor);
    expect(demoDomain.briefing(supervisor).changedLines).toEqual([]);
    demoDomain.createIssue({ title: "Haul road washout at ramp 3", description: "Water has cut across the ramp and the road is not passable for loaded trucks.", priority: "high", reportedBy: "Amina Patel", areaId: null, equipmentId: null, submissionId: "briefing-test-1" }, supervisor);
    const view = demoDomain.briefing(supervisor);
    expect(view.record.state).toBe("approved");
    expect(view.changedLines).toContain("open");
  });
});

describe("reopening", () => {
  it("needs a reason, returns it to a draft, keeps the earlier approval in the history, and can be approved again", () => {
    rejects(() => demoDomain.reopenBriefing({ reason: "Nothing to reopen yet." }, supervisor), 409, /not been approved/);
    demoDomain.approveBriefing({ corrections: { production: "Production: 156,200 t reported (to be re-weighed)." } }, supervisor);
    rejects(() => demoDomain.reopenBriefing({ reason: "" }, supervisor), 400);
    const reopened = demoDomain.reopenBriefing({ reason: "The weighbridge figure changed." }, supervisor);
    expect(reopened.record).toMatchObject({ state: "draft", approvedBy: null, approvedAt: null });
    expect(reopened.record.history.map((item) => item.summary)).toEqual(["Approved with 1 correction", "Reopened for review: The weighbridge figure changed."]);
    // The correction is still there to edit; approving again records a second approval.
    expect(reopened.lines.find((line) => line.id === "production")!.edited).toBe(true);
    const again = demoDomain.approveBriefing({ corrections: { production: "Production: 156,200 t reported. Re-weighed: 155,900 t." } }, manager);
    expect(again.record).toMatchObject({ state: "approved", approvedBy: "John Dlamini" });
    expect(again.record.history).toHaveLength(3);
  });
});
