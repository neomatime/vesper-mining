import { describe, expect, it } from "vitest";
import type { MaintenancePlan } from "@vesper/api-contracts";
import { canActOnEquipment, isValidCode, mostUrgent, normaliseCode, planStatus } from "./equipment-rules";

const NOW = "2025-04-24T08:47:00+02:00";

const hoursPlan = (overrides: Partial<MaintenancePlan> = {}): MaintenancePlan => ({
  id: "p1",
  name: "1,000 hour service",
  basis: "hours",
  interval: 1000,
  lastServiceHours: 0,
  lastServiceAt: null,
  ...overrides,
});

describe("planStatus (hours)", () => {
  it("follows the PRD example: 800 of 1,000 hours at 10 hours a day is about 20 days", () => {
    const status = planStatus(hoursPlan(), { hours: 800, hoursPerDay: 10 }, NOW);
    expect(status.remainingHours).toBe(200);
    expect(status.remainingDays).toBe(20);
    expect(status.label).toBe("Due in 20 days");
    expect(status.state).toBe("ok");
  });

  it("says so when the figures are missing instead of guessing", () => {
    expect(planStatus(hoursPlan(), { hours: null, hoursPerDay: 10 }, NOW).state).toBe("unknown");
    expect(planStatus(hoursPlan({ lastServiceHours: null }), { hours: 800, hoursPerDay: 10 }, NOW).state).toBe("unknown");
  });

  it("falls back to hours when usage per day is unknown", () => {
    const status = planStatus(hoursPlan(), { hours: 800, hoursPerDay: null }, NOW);
    expect(status.label).toBe("Due in 200 hours");
    expect(status.remainingDays).toBeNull();
  });

  it("marks due soon within ten percent of the interval, and overdue past it", () => {
    expect(planStatus(hoursPlan(), { hours: 920, hoursPerDay: 10 }, NOW).state).toBe("due_soon");
    const overdue = planStatus(hoursPlan(), { hours: 1040, hoursPerDay: 10 }, NOW);
    expect(overdue.state).toBe("overdue");
    expect(overdue.label).toBe("Overdue by 40 hours");
  });

  it("never presents an overdue service as a future requirement", () => {
    expect(planStatus(hoursPlan(), { hours: 1000, hoursPerDay: 10 }, NOW).state).toBe("overdue");
  });
});

describe("planStatus (days)", () => {
  const days = (last: string | null, interval = 90): MaintenancePlan => hoursPlan({ basis: "days", interval, lastServiceHours: null, lastServiceAt: last });

  it("counts calendar days from the last service", () => {
    const status = planStatus(days("2025-03-01T08:00:00+02:00"), { hours: null, hoursPerDay: null }, NOW);
    expect(status.state).toBe("ok");
    expect(status.remainingDays).toBe(36);
  });

  it("flags overdue and unknown", () => {
    expect(planStatus(days("2024-12-01T08:00:00+02:00"), { hours: null, hoursPerDay: null }, NOW).state).toBe("overdue");
    expect(planStatus(days(null), { hours: null, hoursPerDay: null }, NOW).state).toBe("unknown");
  });
});

describe("mostUrgent", () => {
  it("puts overdue ahead of due soon ahead of ok", () => {
    const ok = planStatus(hoursPlan({ id: "a" }), { hours: 100, hoursPerDay: 10 }, NOW);
    const overdue = planStatus(hoursPlan({ id: "b" }), { hours: 1100, hoursPerDay: 10 }, NOW);
    expect(mostUrgent([ok, overdue])?.planId).toBe("b");
    expect(mostUrgent([])).toBeNull();
  });
});

describe("codes and permissions", () => {
  it("tidies codes and validates them", () => {
    expect(normaliseCode(" ex 204 ")).toBe("EX-204");
    expect(isValidCode("EX-204")).toBe(true);
    expect(isValidCode("E")).toBe(false);
    expect(isValidCode("EX_204")).toBe(false);
  });

  it("limits management to the Mine Manager and Maintenance Planner", () => {
    expect(canActOnEquipment("manage", { name: "Lebo Maseko", role: "Maintenance Planner" }).allowed).toBe(true);
    expect(canActOnEquipment("manage", { name: "Amina Patel", role: "Shift Supervisor" }).allowed).toBe(false);
    expect(canActOnEquipment("service", { name: "Amina Patel", role: "Shift Supervisor" }).allowed).toBe(true);
    expect(canActOnEquipment("reading", { name: "Thabo Molefe", role: "Field Employee" }).allowed).toBe(true);
    expect(canActOnEquipment("state", { name: "Thabo Molefe", role: "Field Employee" }).allowed).toBe(false);
  });
});
