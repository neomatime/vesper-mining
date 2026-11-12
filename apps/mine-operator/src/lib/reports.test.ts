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
