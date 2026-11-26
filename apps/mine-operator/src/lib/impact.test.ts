// @vitest-environment node

/**
 * Unit tests (Vitest). The Gold demonstration: the shared impact calculation and its three required outcomes, the connected records,
 * repair completion that keeps the actual downtime and the remaining shortfall, the history of changes, and who sees money.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoError, demoDomain } from "./demo-store";
import { GOLD, calculateImpact, plannedSalesValue, totalValueDelayed } from "./impact-rules";
import type { Actor } from "./issue-rules";

const manager: Actor = { name: "John Dlamini", role: "Mine Manager" };
const supervisor: Actor = { name: "Amina Patel", role: "Shift Supervisor" };
const planner: Actor = { name: "Lebo Maseko", role: "Maintenance Planner" };
const stores: Actor = { name: "Naledi Khoza", role: "Stores / Inventory Controller" };
const finance: Actor = { name: "Zinhle Mahlangu", role: "Commercial / Finance Officer" };

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

const inputs = (outageHours: number | null, overrides: Partial<Parameters<typeof calculateImpact>[0]> = {}) => ({ outageHours, usableStockTonnes: 250, catchUpTonnes: 50, recoveredGrams: 0, ...overrides });

beforeEach(() => demoDomain.reset());

describe("the shared calculation", () => {
  it.each([
    [2, 0, 0, 1000, 0],
    [4, 100, 180, 820, 180000],
    [6, 300, 540, 460, 540000],
  ])("gives the required outcome for a %i hour outage", (hours, shortfall, gold, forecast, value) => {
    expect(calculateImpact(inputs(hours))).toMatchObject({ assessed: true, oreShortfallTonnes: shortfall, goldAffectedGrams: gold, remainingShortfallGrams: gold, forecastGrams: forecast, valueDelayed: value });
  });

  it("never lets the shortfall go below zero", () => {
    expect(calculateImpact(inputs(1))).toMatchObject({ oreShortfallTonnes: 0, goldAffectedGrams: 0, forecastGrams: 1000, valueDelayed: 0 });
  });

  it("caps the gold affected at what is still required, and keeps the forecast at zero or more", () => {
    const result = calculateImpact(inputs(40, { usableStockTonnes: 0, catchUpTonnes: 0 }));
    expect(result.goldAffectedGrams).toBe(GOLD.requiredGrams);
    expect(result.forecastGrams).toBe(0);
    expect(result.valueDelayed).toBe(1_000_000);
  });

  it("responds to usable stock and to an approved catch-up plan", () => {
    expect(calculateImpact(inputs(4, { catchUpTonnes: 150 }))).toMatchObject({ oreShortfallTonnes: 0, forecastGrams: 1000 });
    expect(calculateImpact(inputs(4, { catchUpTonnes: 0 }))).toMatchObject({ oreShortfallTonnes: 150, goldAffectedGrams: 270 });
    expect(calculateImpact(inputs(4, { usableStockTonnes: 100 }))).toMatchObject({ oreShortfallTonnes: 250 });
  });

  it("says how long stock keeps processing running", () => {
    expect(calculateImpact(inputs(4)).stockCoverHours).toBe(3);
    expect(calculateImpact(inputs(4, { catchUpTonnes: 0 })).stockCoverHours).toBe(2.5);
  });

  it("is honest when an input is missing: not assessed, and no number is invented", () => {
    const result = calculateImpact(inputs(null));
    expect(result).toMatchObject({ assessed: false, goldAffectedGrams: null, forecastGrams: null, valueDelayed: null });
    expect(result.missing[0]).toMatch(/outage/);
    expect(calculateImpact(inputs(4, { usableStockTonnes: null })).assessed).toBe(false);
  });

  it("subtracts recorded recovery from what is still short, and only that", () => {
    expect(calculateImpact(inputs(6, { recoveredGrams: 200 }))).toMatchObject({ goldAffectedGrams: 540, remainingShortfallGrams: 340, forecastGrams: 660, valueDelayed: 340000 });
  });

  it("counts the same affected output once, however many issues affect it", () => {
    expect(totalValueDelayed([{ scenarioId: "gold-demo", valueDelayed: 180000 }, { scenarioId: "gold-demo", valueDelayed: 180000 }])).toBe(180000);
    expect(totalValueDelayed([{ scenarioId: "gold-demo", valueDelayed: 180000 }, { scenarioId: "other", valueDelayed: 20000 }, { scenarioId: "x", valueDelayed: null }])).toBe(200000);
  });
});

describe("the connected records", () => {
  it("starts with one coherent, clearly labelled timeline and a fixed commitment", () => {
    const view = demoDomain.impact(manager);
    expect(view.scenario).toMatchObject({ label: "Gold delivery", commitmentGrams: 1000, outageHours: 4, usableStockTonnes: 250, catchUpTonnes: 50 });
    expect(view.plannedValue).toBe(plannedSalesValue);
    expect(plannedSalesValue).toBe(1_000_000);
    expect(view.result).toMatchObject({ goldAffectedGrams: 180, forecastGrams: 820, valueDelayed: 180000 });
    expect(view.equipment).toMatchObject({ code: "CR-01", state: "unavailable" });
    expect(view.issue).toMatchObject({ title: "Crusher CR-01 — Motor Drive Failure", owner: "Lebo Maseko" });
    expect(view.repair).toMatchObject({ title: "Replace the drive coupling", owner: "Lebo Maseko" });
    expect(view.part).toMatchObject({ name: "Drive coupling DC-CR01", onHand: null, inbound: 1 });
    expect(view.expectedRepairCompletion).toBe("2025-04-24T10:00:00+02:00");
  });

  it("puts the breakdown in the ordinary equipment, issue and readiness records too", () => {
    expect(demoDomain.listEquipment().some((item) => item.code === "CR-01")).toBe(true);
    expect(demoDomain.listIssues().some((item) => item.id === "issue-gold-001")).toBe(true);
  });
});

describe("changing the estimate", () => {
  it("updates the forecast everywhere from one change, and keeps the previous estimate, the reason and who changed it", () => {
    demoDomain.updateImpact({ outageHours: 6, reason: "The supplier now says the coupling will be late." }, planner);
    const view = demoDomain.impact(manager); // the manager sees the rand figures; the planner sees grams and hours
    expect(view.result).toMatchObject({ goldAffectedGrams: 540, forecastGrams: 460, valueDelayed: 540000 });
    expect(view.expectedRepairCompletion).toBe("2025-04-24T12:00:00+02:00");
    expect(view.history).toHaveLength(1);
    expect(view.history[0]).toMatchObject({ kind: "estimate", actor: planner.name, reason: "The supplier now says the coupling will be late." });
    expect(view.history[0].previous).toMatchObject({ outageHours: 4, goldAffectedGrams: 180, forecastGrams: 820, valueDelayed: 180000 });
    expect(view.history[0].revised).toMatchObject({ outageHours: 6, goldAffectedGrams: 540, forecastGrams: 460, valueDelayed: 540000 });
  });

  it("leaves the customer commitment, verified inventory and the shipments alone", () => {
    const stockBefore = JSON.stringify(demoDomain.logistics(manager).stockpiles);
    const shipmentsBefore = JSON.stringify(demoDomain.logistics(manager).shipments);
    const view = demoDomain.updateImpact({ outageHours: 6, usableStockTonnes: 100, reason: "Worst case for the manager's briefing." }, manager);
    expect(view.scenario.commitmentGrams).toBe(1000);
    expect(view.plannedValue).toBe(1_000_000);
    expect(JSON.stringify(demoDomain.logistics(manager).stockpiles)).toBe(stockBefore);
    expect(JSON.stringify(demoDomain.logistics(manager).shipments)).toBe(shipmentsBefore);
  });

  it("shows Impact not yet assessed when a required input is cleared", () => {
    const view = demoDomain.updateImpact({ usableStockTonnes: null, reason: "The stock count has not been done yet." }, supervisor);
    expect(view.result).toMatchObject({ assessed: false, forecastGrams: null, valueDelayed: null });
  });

  it("needs a reason, a sensible number and the right role", () => {
    rejects(() => demoDomain.updateImpact({ outageHours: 6, reason: "" }, planner), 400);
    rejects(() => demoDomain.updateImpact({ outageHours: 500, reason: "A typing slip." }, planner), 400);
    rejects(() => demoDomain.updateImpact({ reason: "Nothing changed." }, planner), 400, /at least one input/);
    rejects(() => demoDomain.updateImpact({ outageHours: 6, reason: "Not my area." }, stores), 403);
    rejects(() => demoDomain.updateImpact({ outageHours: 6, reason: "Not my area." }, finance), 403);
  });
});

describe("recording the repair as complete", () => {
  it("keeps the actual downtime and the shortfall it left, and marks the records as reported, not verified", () => {
    demoDomain.completeRepair({ actualOutageHours: 6, note: "Coupling fitted and the crusher restarted." }, planner);
    const view = demoDomain.impact(manager);
    expect(view.scenario).toMatchObject({ actualOutageHours: 6, outageHours: 6 });
    expect(view.scenario.repairCompletedAt).not.toBeNull();
    expect(view.result).toMatchObject({ goldAffectedGrams: 540, remainingShortfallGrams: 540, forecastGrams: 460, valueDelayed: 540000 });
    expect(view.equipment).toMatchObject({ state: "available" });
    expect(demoDomain.listEquipment().find((item) => item.code === "CR-01")!.stateQuality).toBe("reported");
    expect(view.issue!.state).toBe("resolution_reported");
    expect(view.history.at(-1)).toMatchObject({ kind: "repair_complete" });
  });

  it("recalculates from the actual outage, not the estimate", () => {
    demoDomain.completeRepair({ actualOutageHours: 2, note: "It was quicker than feared." }, planner);
    const view = demoDomain.impact(manager);
    expect(view.result).toMatchObject({ oreShortfallTonnes: 0, forecastGrams: 1000, valueDelayed: 0 });
    expect(view.history.at(-1)!.previous).toMatchObject({ outageHours: 4, goldAffectedGrams: 180 });
  });

  it("will not let the recorded actual be edited, or the repair be completed twice", () => {
    demoDomain.completeRepair({ actualOutageHours: 6, note: "Done." }, planner);
    rejects(() => demoDomain.completeRepair({ actualOutageHours: 3, note: "Again." }, planner), 409);
    rejects(() => demoDomain.updateImpact({ outageHours: 2, reason: "Trying to rewrite the downtime." }, planner), 409, /recorded actual/);
  });

  it("recovers the shortfall only through recorded progress, and only up to what is short", () => {
    demoDomain.completeRepair({ actualOutageHours: 6, note: "Done." }, planner);
    rejects(() => demoDomain.recordRecovery({ grams: 100, note: "Not allowed for this role." }, planner), 403);
    demoDomain.recordRecovery({ grams: 200, note: "Extra shift processed stockpiled ore (record PR-0150)." }, supervisor);
    const view = demoDomain.impact(manager);
    expect(view.result).toMatchObject({ goldAffectedGrams: 540, remainingShortfallGrams: 340, forecastGrams: 660, valueDelayed: 340000 });
    expect(view.scenario.recoveredGrams).toBe(200);
    rejects(() => demoDomain.recordRecovery({ grams: 400, note: "More than is short." }, supervisor), 409, /Only 340 g/);
    // Recovery is recorded progress. It does not touch physical inventory.
    expect(JSON.stringify(demoDomain.logistics(manager).stockpiles)).not.toMatch(/gold/i);
  });

  it("resets the demonstration to its start", () => {
    demoDomain.completeRepair({ actualOutageHours: 6, note: "Done." }, planner);
    const view = demoDomain.resetImpact(manager);
    expect(view.scenario).toMatchObject({ outageHours: 4, actualOutageHours: null, repairCompletedAt: null, recoveredGrams: 0 });
    expect(view.history).toHaveLength(0);
    expect(view.equipment).toMatchObject({ state: "unavailable" });
    expect(view.issue!.state).toBe("awaiting_dependency");
  });
});

describe("who sees money", () => {
  it("shows rand amounts only to people allowed to see value, and still shows grams and hours to everyone", () => {
    demoDomain.updateImpact({ outageHours: 6, reason: "Checking what operations can see." }, planner);
    for (const actor of [planner, supervisor, stores]) {
      const view = demoDomain.impact(actor);
      expect(view.canSeeValue).toBe(false);
      expect(view.result).toMatchObject({ goldAffectedGrams: 540, forecastGrams: 460, valueDelayed: null });
      expect(view.plannedValue).toBeNull();
      expect(JSON.stringify(view)).not.toMatch(/540000|1000000|"valueDelayed":[1-9]/);
    }
    expect(demoDomain.impact(manager)).toMatchObject({ canSeeValue: true, result: { valueDelayed: 540000 } });
    expect(demoDomain.impact(finance)).toMatchObject({ canSeeValue: true });
  });
});
