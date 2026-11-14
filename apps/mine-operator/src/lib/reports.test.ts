// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { buildReport, delayStages, reportCatalogue } from "./reports";
import { demoDomain } from "./demo-store";

const manager = { name: "John Dlamini", role: "Mine Manager" };

function input() {
  const state = demoDomain.get();
  return { issues: demoDomain.listIssues(), readiness: state.readiness, now: demoDomain.now() };
}

beforeEach(() => demoDomain.reset());

describe("report catalogue", () => {
  it("builds every report, with only delay analytics marked advanced", () => {
    for (const item of reportCatalogue) expect(buildReport(item.key, input())).not.toBeNull();
    expect(reportCatalogue.filter((item) => item.advanced).map((item) => item.key)).toEqual(["delay-analytics"]);
  });

  it("returns null for an unknown report", () => {
    expect(buildReport("nope", input())).toBeNull();
  });

  it("gives each report its own content, not a shared chart", () => {
    const keys = reportCatalogue.map((item) => JSON.stringify(buildReport(item.key, input())?.chart.series));
    expect(new Set(keys).size).toBeGreaterThan(3);
  });
});

describe("live reports", () => {
  it("reflects new issues in the exceptions report", () => {
    const before = buildReport("operational-exceptions", input());
    demoDomain.createIssue({ title: "Belt tracking fault", description: "The feed belt is tracking off centre." }, manager);
    const after = buildReport("operational-exceptions", input());
    expect(after?.rows.length).toBe((before?.rows.length ?? 0) + 1);
  });

  it("splits time into active, waiting and coordination without summing them", () => {
    const stages = delayStages(demoDomain.listIssues(), demoDomain.now());
    const open = stages.filter((stage) => !stage.final);
    expect(open.length).toBeGreaterThan(0);
    const report = buildReport("equipment-delay-stages", input());
    expect(report?.columns.map((column) => column.key)).toContain("type");
    expect(report?.caveat).toMatch(/not automatically avoidable/);
  });

  it("keeps unknown stock out of the allocable bars", () => {
    const report = buildReport("resource-readiness", input());
    const oil = report?.chart.data.find((row) => row.label === "OEM engine oil pack");
    expect(oil?.allocable).toBeNull();
    const row = report?.rows.find((entry) => entry.part === "OEM engine oil pack");
    expect(row?.allocable).toBe("Unknown");
  });
});

describe("recurring causes report", () => {
  const base = { title: "Fault on EX-204", description: "A fault was observed during the pre-start check.", equipmentId: "eq-ex204" };
  const field = { name: "Thabo Molefe", role: "Field Employee" };
  const raise = (symptom: string, secondary?: string) => demoDomain.createIssue({ ...base, defect: { symptom, secondary, operability: "unsure" } }, field);

  it("ranks primary causes, and breaks each one down by the secondary causes from its own list", () => {
    raise("hydraulic", "hose_or_fitting_leak");
    raise("hydraulic", "hose_or_fitting_leak");
    raise("hydraulic", "cylinder_or_seal_leak");
    raise("engine_fuel", "overheating");
    raise("engine_fuel");
    const report = buildReport("recurring-causes", input());
    expect(report?.chart.data).toEqual([{ label: "Hydraulic system", issues: 3 }, { label: "Engine and fuel", issues: 2 }]);
    expect(report?.rows).toEqual([
      { primary: "Hydraulic system", secondary: "Hose or fitting leak", count: 2, latest: expect.any(String) },
      { primary: "Hydraulic system", secondary: "Cylinder or seal leak", count: 1, latest: expect.any(String) },
      { primary: "Engine and fuel", secondary: "No secondary cause", count: 1, latest: expect.any(String) },
      { primary: "Engine and fuel", secondary: "Overheating", count: 1, latest: expect.any(String) },
    ]);
    expect(report?.issues).toHaveLength(5);
    expect(report?.caveat).toMatch(/not verified/i);
  });

  it("is empty, not invented, before any cause has been recorded", () => {
    expect(buildReport("recurring-causes", input())?.rows).toEqual([]);
  });

  it("still reads a record made before secondary causes had their own lists", () => {
    const issue = raise("hydraulic");
    issue.defect = { symptom: "leak" as never, secondary: "overheating", operability: "unsure" };
    const rows = buildReport("recurring-causes", { ...input(), issues: [issue] })?.rows;
    expect(rows).toEqual([{ primary: "Leak", secondary: "Overheating", count: 1, latest: issue.issueNumber }]);
  });
});
