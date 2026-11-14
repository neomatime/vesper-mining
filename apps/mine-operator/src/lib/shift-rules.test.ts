import { describe, expect, it } from "vitest";
import { buildShiftTimes, canActOnShift, currentShiftFor, peopleOn, shiftHours, shiftsOverlap } from "./shift-rules";

const manager = { name: "John Dlamini", role: "Mine Manager" };
const amina = { name: "Amina Patel", role: "Shift Supervisor" };
const sipho = { name: "Sipho Nkosi", role: "Shift Supervisor" };
const planner = { name: "Lebo Maseko", role: "Maintenance Planner" };

const shift = { supervisor: "Amina Patel", work: [{ id: "w1", title: "Task", owner: "Thabo Molefe", issueId: null, done: false, doneAt: null }] };

describe("buildShiftTimes", () => {
  it("builds a day shift in site time", () => {
    const { startsAt, endsAt } = buildShiftTimes("2025-04-24", "06:00", "14:00");
    expect(startsAt).toBe("2025-04-24T06:00:00+02:00");
    expect(endsAt).toBe("2025-04-24T14:00:00+02:00");
    expect(shiftHours({ startsAt, endsAt })).toBe(8);
  });

  it("treats an end at or before the start as the next day", () => {
    const { startsAt, endsAt } = buildShiftTimes("2025-04-24", "22:00", "06:00");
    expect(endsAt).toBe("2025-04-25T06:00:00+02:00");
    expect(shiftHours({ startsAt, endsAt })).toBe(8);
  });
});

describe("shiftsOverlap", () => {
  const a = { startsAt: "2025-04-24T06:00:00+02:00", endsAt: "2025-04-24T14:00:00+02:00" };
  it("allows shifts that meet end to start", () => {
    expect(shiftsOverlap(a, { startsAt: "2025-04-24T14:00:00+02:00", endsAt: "2025-04-24T22:00:00+02:00" })).toBe(false);
  });
  it("catches real overlap", () => {
    expect(shiftsOverlap(a, { startsAt: "2025-04-24T13:00:00+02:00", endsAt: "2025-04-24T21:00:00+02:00" })).toBe(true);
  });
});

describe("permissions", () => {
  it("lets management manage shifts and nobody else", () => {
    expect(canActOnShift("manage", amina).allowed).toBe(true);
    expect(canActOnShift("manage", planner).allowed).toBe(false);
  });

  it("keeps starting and handing over to the shift's own supervisor or the Mine Manager", () => {
    expect(canActOnShift("run", amina, shift).allowed).toBe(true);
    expect(canActOnShift("run", sipho, shift).allowed).toBe(false);
    expect(canActOnShift("run", manager, shift).allowed).toBe(true);
    expect(canActOnShift("handover", sipho, shift).allowed).toBe(false);
  });

  it("lets the next supervisor acknowledge, but not the outgoing one", () => {
    expect(canActOnShift("acknowledge", sipho, shift, { supervisor: "Sipho Nkosi" }).allowed).toBe(true);
    expect(canActOnShift("acknowledge", amina, shift, { supervisor: "Sipho Nkosi" }).allowed).toBe(false);
    expect(canActOnShift("acknowledge", manager, shift, null).allowed).toBe(true);
  });

  it("lets the person a task is assigned to update it", () => {
    expect(canActOnShift("work", { name: "Thabo Molefe", role: "Field Employee" }, shift).allowed).toBe(true);
    expect(canActOnShift("work", { name: "Other Person", role: "Field Employee" }, shift).allowed).toBe(false);
  });
});

describe("peopleOn", () => {
  it("lists the supervisor and crew once each", () => {
    expect(peopleOn({ supervisor: "Amina Patel", crew: [{ id: "c", name: "Thabo Molefe", duty: "Operator", equipmentId: null }] })).toEqual(["Amina Patel", "Thabo Molefe"]);
    expect(peopleOn({ supervisor: null, crew: [] })).toEqual([]);
  });
});

describe("currentShiftFor", () => {
  const mk = (over: Record<string, unknown>) => ({ state: "in_progress", startsAt: "2025-04-24T06:00:00+02:00", supervisor: "Amina Patel", crew: [], work: [], ...over }) as never;

  it("finds a shift a person supervises, is crew on, or has been given work on, even when not on the crew", () => {
    expect(currentShiftFor([mk({})], "Amina Patel")).toBeDefined();
    expect(currentShiftFor([mk({ crew: [{ name: "Thabo Molefe" }] })], "Thabo Molefe")).toBeDefined();
    expect(currentShiftFor([mk({ work: [{ owner: "Naledi Khoza" }] })], "Naledi Khoza")).toBeDefined();
    expect(currentShiftFor([mk({})], "Naledi Khoza")).toBeUndefined();
  });

  it("prefers the shift in progress, then the earliest one still to start, and ignores closed ones", () => {
    const later = mk({ state: "scheduled", startsAt: "2025-04-24T22:00:00+02:00", crew: [{ name: "Thabo Molefe" }], id: "later" });
    const sooner = mk({ state: "scheduled", startsAt: "2025-04-24T14:00:00+02:00", crew: [{ name: "Thabo Molefe" }], id: "sooner" });
    const live = mk({ crew: [{ name: "Thabo Molefe" }], id: "live" });
    const closed = mk({ state: "closed", crew: [{ name: "Thabo Molefe" }], id: "closed" });
    expect((currentShiftFor([later, sooner, live, closed], "Thabo Molefe") as unknown as { id: string }).id).toBe("live");
    expect((currentShiftFor([later, sooner, closed], "Thabo Molefe") as unknown as { id: string }).id).toBe("sooner");
  });
});
