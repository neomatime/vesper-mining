import type { EquipmentEvent, OperationalIssue, Shift } from "@vesper/api-contracts";
import { describe, expect, it } from "vitest";
import { draftShiftReport, reportSources, reportToText } from "./shift-report";

const shift = {
  name: "Shift A",
  startsAt: "2025-04-24T06:00:00+02:00",
  endsAt: "2025-04-24T14:00:00+02:00",
  startedAt: "2025-04-24T06:02:00+02:00",
  closedAt: null,
  work: [
    { id: "w1", title: "North Pit pre-start observation", owner: "Thabo Molefe", issueId: null, done: true, doneAt: "2025-04-24T06:18:00+02:00" },
    { id: "w2", title: "Clear feed chute", owner: "Lebo Maseko", issueId: "issue-1", done: false, doneAt: null },
  ],
} as unknown as Shift;

const event = (over: Record<string, unknown>) => ({ id: "e", type: "state_changed", summary: "x", actor: "A", actorRole: "r", occurredAt: "2025-04-24T09:00:00+02:00", previousState: null, nextState: null, note: null, ...over });
const issue = (over: Record<string, unknown>) => ({ id: "issue-1", issueNumber: "RIV-001", title: "Crusher C-02 feed interruption", workflowState: "awaiting_dependency", owner: "Lebo Maseko", dependencies: [], events: [], ...over }) as unknown as OperationalIssue;
const now = "2025-04-24T13:00:00+02:00";

describe("draftShiftReport", () => {
  it("adds what was done and how many files were attached to a finished task", () => {
    const withNote = { ...shift, work: [{ id: "w1", title: "Check liners", owner: "Naledi Khoza", issueId: null, done: true, doneAt: "2025-04-24T07:00:00+02:00", completion: { note: "Counted 6 on the shelf.", evidence: [{ name: "a.jpg", kind: "photo", sizeLabel: "1 MB" }], by: "Naledi Khoza" } }] } as unknown as Shift;
    const text = draftShiftReport({ shift: withNote, issues: [], equipment: [], now }).sections.find((s) => s.key === "work_done")!.lines[0]!.text;
    expect(text).toBe("Check liners, Naledi Khoza (done 07:00): Counted 6 on the shelf. [1 file attached]");
  });

  it("splits work into done and not done, with owners and times", () => {
    const draft = draftShiftReport({ shift, issues: [], equipment: [], now });
    expect(draft.sections.find((s) => s.key === "work_done")?.lines[0]?.text).toContain("Thabo Molefe");
    expect(draft.sections.find((s) => s.key === "work_done")?.lines[0]?.text).toContain("06:18");
    expect(draft.sections.find((s) => s.key === "work_open")?.lines[0]?.href).toBe("/exceptions/issue-1");
  });

  it("includes only issue activity from inside the shift, and links to the record", () => {
    const inside = issue({ events: [event({ type: "reported", occurredAt: "2025-04-24T07:10:00+02:00" }), event({ nextState: "action_assigned", occurredAt: "2025-04-24T08:00:00+02:00" })] });
    const outside = issue({ id: "issue-2", issueNumber: "RIV-002", events: [event({ type: "reported", occurredAt: "2025-04-23T07:10:00+02:00" })] });
    const lines = draftShiftReport({ shift, issues: [inside, outside], equipment: [], now }).sections.find((s) => s.key === "issues")!.lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toContain("reported 07:10");
    expect(lines[0]?.href).toBe("/exceptions/issue-1");
  });

  it("carries open issues forward with the dependencies holding them", () => {
    const held = issue({ dependencies: [{ id: "d", reason: "Wear plates not confirmed", owner: "Naledi Khoza", state: "open" }] });
    const done = issue({ id: "issue-3", issueNumber: "RIV-003", workflowState: "closed" });
    const lines = draftShiftReport({ shift, issues: [held, done], equipment: [], now }).sections.find((s) => s.key === "carried")!.lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toContain("waiting on Wear plates not confirmed (Naledi Khoza)");
  });

  it("reports availability changes in the window and equipment that is unavailable now", () => {
    const changes = [{ ...event({ type: "state_changed", summary: "Reported unavailable", note: "Feed blocked" }) }] as unknown as EquipmentEvent[];
    const equipment = [{ id: "eq-1", code: "CR-02", name: "Crusher C-02", state: "unavailable" as const, stateNote: "Feed blocked", events: changes }];
    const lines = draftShiftReport({ shift, issues: [], equipment, now }).sections.find((s) => s.key === "equipment")!.lines;
    expect(lines.map((l) => l.text).join(" | ")).toContain("Reported unavailable (09:00, Feed blocked)");
    expect(lines.some((l) => l.text.includes("is reported unavailable"))).toBe(true);
  });
});

describe("reportToText", () => {
  it("labels the draft as prepared by VESPER, never mentions production tonnes, and leaves room for the supervisor", () => {
    const draft = draftShiftReport({ shift, issues: [], equipment: [], now });
    const text = reportToText(draft, "Shift A");
    expect(text.split("\n")[0]).toMatch(/^Prepared from VESPER records for Shift A at 13:00/);
    expect(text).not.toMatch(/tonne|\bkt\b|\bR\d/i);
    expect(text).toContain("- Nothing recorded");
    expect(text.trimEnd().endsWith("SUPERVISOR NOTES")).toBe(true);
  });

  it("lists each source record once", () => {
    const bare = { ...shift, work: [] } as unknown as Shift;
    const draft = draftShiftReport({ shift: bare, issues: [issue({ events: [event({ type: "reported", occurredAt: "2025-04-24T07:10:00+02:00" })] })], equipment: [], now });
    const sources = reportSources(draft);
    expect(sources.filter((s) => s.href === "/exceptions/issue-1")).toHaveLength(1);
    expect(sources.find((s) => s.href === "/exceptions/issue-1")?.label).toBe("RIV-001");
  });
});
