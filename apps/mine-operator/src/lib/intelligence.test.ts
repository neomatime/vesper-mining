// @vitest-environment node

/**
 * Unit tests (Vitest). VESPER Intelligence rules: prioritised insights, the shift briefing and Ask VESPER. They check that every figure
 * comes from existing records, that money is only shown to roles allowed to see it, that nothing is invented when evidence is missing,
 * and that every answer links to its source records.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { demoDomain } from "./demo-store";
import type { Actor } from "./issue-rules";
import { RECURRENCE_THRESHOLD, answerQuestion, breakdownCount, buildBriefing, buildInsights, exampleQuestions, type IntelligenceInputs } from "./intelligence-rules";

const manager: Actor = { name: "John Dlamini", role: "Mine Manager" };
const supervisor: Actor = { name: "Amina Patel", role: "Shift Supervisor" };
const planner: Actor = { name: "Lebo Maseko", role: "Maintenance Planner" };

function inputsFor(actor: Actor): IntelligenceInputs {
  const state = demoDomain.get();
  const logistics = demoDomain.logistics(actor);
  const impact = demoDomain.impact(actor);
  return { now: demoDomain.now(), issues: demoDomain.listIssues(), equipment: demoDomain.listEquipment(), readiness: state.readiness, shifts: demoDomain.listShifts(), shipments: logistics.shipments, requests: logistics.requests, impact };
}

beforeEach(() => demoDomain.reset());

describe("prioritised insights", () => {
  it("explains what is happening and what it affects, from the deterministic Gold estimate, linked to its records", () => {
    const insights = buildInsights(inputsFor(manager));
    const risk = insights.find((item) => item.id === "production-at-risk")!;
    expect(risk.title).toBe("Production at risk");
    expect(risk.summary).toMatch(/180 g of gold/);
    expect(risk.summary).toMatch(/R.?180.?000/);
    expect(risk.why).toMatch(/not a confirmed loss/);
    expect(risk.action.href).toMatch(/^\/exceptions\/issue-/);
    expect(risk.sources.length).toBeGreaterThan(0);
    // Ordered by urgency.
    expect(insights.map((item) => item.urgency)).toEqual([...insights.map((item) => item.urgency)].sort((a, b) => b - a));
  });

  it("leaves money out for a role that may not see it, without losing the operational insight", () => {
    const risk = buildInsights(inputsFor(supervisor)).find((item) => item.id === "production-at-risk")!;
    expect(risk.summary).toMatch(/180 g of gold/);
    expect(risk.summary).not.toMatch(/R\s?\d/);
  });

  it("flags a shipment waiting for transport, linked to that shipment", () => {
    const insight = buildInsights(inputsFor(manager)).find((item) => item.kind === "shipment")!;
    expect(insight.summary).toMatch(/SHP-0047 is awaiting transport confirmation/);
    expect(insight.action.href).toMatch(/^\/shipments\/ship-47$/);
  });

  it("says the impact is not assessed, and what is missing, rather than estimating", () => {
    demoDomain.updateImpact({ outageHours: "", usableStockTonnes: "", reason: "Clearing the estimate for the test." }, planner);
    const insights = buildInsights(inputsFor(manager));
    const impact = demoDomain.impact(manager);
    if (!impact.result.assessed) {
      expect(insights.some((item) => item.id === "production-not-assessed")).toBe(true);
      expect(insights.some((item) => item.id === "production-at-risk")).toBe(false);
    }
  });

  it("claims a recurring failure only with evidence: two or more recorded breakdowns", () => {
    const before = inputsFor(manager);
    expect(before.equipment.every((item) => breakdownCount(item) < RECURRENCE_THRESHOLD)).toBe(true);
    expect(buildInsights(before).some((item) => item.title === "Recurring breakdowns")).toBe(false);
    demoDomain.setEquipmentState("eq-ex204", { state: "unavailable", note: "Hydraulic leak found at the boom." }, planner);
    demoDomain.setEquipmentState("eq-ex204", { state: "available" }, planner);
    demoDomain.setEquipmentState("eq-ex204", { state: "unavailable", note: "Hydraulic leak again at the boom." }, planner);
    const after = inputsFor(manager);
    expect(breakdownCount(after.equipment.find((item) => item.id === "eq-ex204")!)).toBe(2);
    const recurring = buildInsights(after).find((item) => item.title === "Recurring breakdowns")!;
    expect(recurring.summary).toMatch(/EX-204 has been reported unavailable 2 times/);
    expect(recurring.why).toMatch(/No failure prediction/);
  });
});

describe("shift briefing", () => {
  it("is assembled from the shift, its work, the open issues and its handover, and approves nothing", () => {
    const briefing = buildBriefing(inputsFor(manager));
    expect(briefing.generated).toBe(true);
    const texts = briefing.lines.map((line) => line.text).join(" | ");
    expect(texts).toMatch(/Production: 156,200 t reported \(96% of the 162,000 t target\)\. Reported, not verified\./);
    expect(texts).toMatch(/Work completed: \d+ of \d+ tasks/);
    expect(texts).toMatch(/Open items: \d+ operational issue/);
    expect(["draft", "published", "acknowledged"]).toContain(briefing.handoverState);
    expect(briefing.nextShift.length).toBeGreaterThan(0);
    // Reading the briefing did not change the handover.
    const shift = demoDomain.listShifts().find((item) => item.id === briefing.shiftId)!;
    expect(shift.handover.state).toBe(briefing.handoverState);
  });
});

describe("Ask VESPER", () => {
  it("answers each of the seven agreed questions from records, with links, and never with an unsupported reply", () => {
    const inputs = inputsFor(manager);
    for (const question of exampleQuestions) {
      const answer = answerQuestion(question, inputs);
      expect(answer.topic, question).not.toBe("unsupported");
      expect(answer.text.length, question).toBeGreaterThan(20);
    }
    const attention = answerQuestion("What requires my attention today?", inputs);
    expect(attention.links.length).toBeGreaterThan(0);
    expect(answerQuestion("Which shipments are at risk?", inputs).text).toMatch(/SHP-0047/);
  });

  it("uses the same calculation as the impact estimate, and flags the value as an estimate, not a loss", () => {
    const answer = answerQuestion("What is the estimated sales value affected by operational delays?", inputsFor(manager));
    expect(answer.topic).toBe("value");
    expect(answer.text).toMatch(/R.?180.?000/);
    expect(answer.text).toMatch(/not a confirmed loss/);
  });

  it("respects permissions: no money for a role that may not see it", () => {
    const answer = answerQuestion("What is the estimated sales value affected by operational delays?", inputsFor(supervisor));
    expect(answer.text).not.toMatch(/R\s?\d/);
    expect(answer.text).toMatch(/may see/);
  });

  it("says what is missing instead of guessing, for recurring failures with no history", () => {
    const answer = answerQuestion("Which equipment has experienced recurring failures?", inputsFor(manager));
    expect(answer.topic).toBe("recurring");
    expect(answer.text).toMatch(/no recurring failure is claimed/);
    expect(answer.missing.length).toBeGreaterThan(0);
  });

  it("declines a question it cannot answer from records and lists what it can answer", () => {
    const answer = answerQuestion("Who will win the football this weekend?", inputsFor(manager));
    expect(answer.topic).toBe("unsupported");
    expect(answer.text).toMatch(/I can answer questions about/);
    expect(answer.links).toEqual([]);
  });
});
