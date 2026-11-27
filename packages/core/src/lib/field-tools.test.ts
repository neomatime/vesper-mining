// @vitest-environment node

/**
 * Unit tests (Vitest). Field tools: the pre-start checklists by machine type, recording a check (every item answered, failures
 * explained, each failure raised as an issue against the machine, the supervisor told), and photos and location on a report.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoError, demoDomain } from "./demo-store";
import type { Actor } from "./issue-rules";
import { checklistFor, checkProblem, latestCheck } from "./prestart-rules";

const field: Actor = { name: "Thabo Molefe", role: "Field Employee" };

function rejects(operation: () => unknown, pattern: RegExp) {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(DemoError);
    expect((error as DemoError).message).toMatch(pattern);
    return;
  }
  throw new Error("Expected the operation to be rejected.");
}

const allPass = (category: Parameters<typeof checklistFor>[0]) => Object.fromEntries(checklistFor(category).map((item) => [item.id, { result: "pass" }]));
const photo = { id: "photo-1", name: "leak.jpg", kind: "photo", sizeLabel: "48 KB", dataUrl: "data:image/jpeg;base64,/9j/4AAQ", takenAt: "2025-04-24T08:40:00+02:00" };

beforeEach(() => {
  demoDomain.reset();
});

describe("pre-start checklists", () => {
  it("fits the machine: tracks for an excavator, tyres and tray for a haul truck, a general list otherwise", () => {
    expect(checklistFor("excavator").map((item) => item.id)).toEqual(expect.arrayContaining(["tracks", "bucket", "fire", "seatbelt"]));
    expect(checklistFor("haul_truck").map((item) => item.id)).toEqual(expect.arrayContaining(["tyres", "brakes", "tray"]));
    expect(checklistFor("loader")).toEqual(checklistFor("water_cart"));
  });

  it("asks for every answer, a note on each failure, and a view on whether the machine can be used", () => {
    const items = checklistFor("excavator");
    expect(checkProblem(items, {}, null)).toMatch(/Answer every item/);
    const answers = { ...allPass("excavator"), hoses: { result: "fail" as const, note: "" } };
    expect(checkProblem(items, answers, "limited")).toMatch(/Hoses and fittings/);
    expect(checkProblem(items, { ...answers, hoses: { result: "fail", note: "Weeping at the boom" } }, null)).toMatch(/can be used/);
    expect(checkProblem(items, { ...answers, hoses: { result: "fail", note: "Weeping at the boom" } }, "limited")).toBeNull();
  });
});

describe("recording a pre-start check", () => {
  it("records a clean check without raising anything", () => {
    const check = demoDomain.submitPrestartCheck({ equipmentId: "eq-ex204", shiftId: "shift-a-20250424", answers: allPass("excavator"), hoursReading: 12480 }, field);
    expect(check).toMatchObject({ equipmentId: "eq-ex204", by: "Thabo Molefe", operability: "yes", hoursReading: 12480, issueIds: [] });
    expect(latestCheck(demoDomain.listPrestartChecks("eq-ex204"), "eq-ex204", "shift-a-20250424", demoDomain.now())?.id).toBe(check.id);
  });

  it("raises each failed item as an issue against the machine and tells the shift supervisor", () => {
    const before = demoDomain.listIssues().length;
    const unitBefore = demoDomain.get().equipment.find((item) => item.id === "eq-ex204")?.state;
    const answers = { ...allPass("excavator"), hoses: { result: "fail", note: "Hose weeping at the boom foot" }, lights: { result: "fail", note: "Reverse alarm silent" } };
    const check = demoDomain.submitPrestartCheck({ equipmentId: "eq-ex204", shiftId: "shift-a-20250424", answers, operability: "no" }, field);
    expect(check.issueIds).toHaveLength(2);
    expect(demoDomain.listIssues()).toHaveLength(before + 2);
    const raised = demoDomain.getIssue(check.issueIds[0]);
    expect(raised).toMatchObject({ equipmentId: "eq-ex204", priority: "high", workflowState: "reported", defect: { symptom: "hydraulic", operability: "stopped" } });
    expect(raised.title).toContain("Hoses and fittings failed pre-start");
    expect(raised.events[0].actor).toBe("Thabo Molefe");
    // A failed check is a report: the machine is not taken out of service by it.
    expect(demoDomain.listEquipment().find((item) => item.id === "eq-ex204")?.state).toBe(unitBefore);
    expect(demoDomain.get().notifications[0]).toMatchObject({ recipient: "Amina Patel", category: "Pre-start", href: `/exceptions/${check.issueIds[0]}` });
  });

  it("refuses an incomplete check, an unexplained failure, fixed plant, and an unknown machine", () => {
    rejects(() => demoDomain.submitPrestartCheck({ equipmentId: "eq-ex204", answers: {} }, field), /Answer every item/);
    rejects(() => demoDomain.submitPrestartCheck({ equipmentId: "eq-ex204", answers: { ...allPass("excavator"), tracks: { result: "fail" } }, operability: "yes" }, field), /Tracks/);
    rejects(() => demoDomain.submitPrestartCheck({ equipmentId: "eq-crusher-c02", answers: {} }, field), /own plan/);
    rejects(() => demoDomain.submitPrestartCheck({ equipmentId: "eq-nothing", answers: {} }, field), /could not be found/);
  });
});

describe("photos and location on a report", () => {
  it("keeps the photos and the reporter's location with the issue", () => {
    const issue = demoDomain.createIssue({ title: "Hydraulic leak at EX-204", description: "Fresh oil under the boom foot pin.", attachments: [photo], reportedLocation: { lat: -24.6612347, lng: 30.0612347, accuracyM: 8.4 } }, field);
    expect(issue.attachments).toHaveLength(1);
    expect(issue.reportedLocation).toEqual({ lat: -24.661235, lng: 30.061235, accuracyM: 8 });
  });

  it("refuses more than four photos, something that is not an image, and an impossible location", () => {
    const base = { title: "Hydraulic leak at EX-204", description: "Fresh oil under the boom foot pin." };
    rejects(() => demoDomain.createIssue({ ...base, attachments: Array.from({ length: 5 }, (_, index) => ({ ...photo, id: `p${index}` })) }, field), /at most four/);
    rejects(() => demoDomain.createIssue({ ...base, attachments: [{ ...photo, dataUrl: "data:text/html;base64,PGgxPg==" }] }, field), /could not be read/);
    rejects(() => demoDomain.createIssue({ ...base, reportedLocation: { lat: 120, lng: 30, accuracyM: 5 } }, field), /location could not be read/);
  });
});
