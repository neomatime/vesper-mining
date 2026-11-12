import { describe, expect, it } from "vitest";
import { addDays, addMonths, dayBlock, dayLabel, dayPosition, shiftsOnDay, endsNextDay, isSameMonth, monthGrid, monthLabel, shiftsByDay, siteDate, startOfWeek, weekDays, weekLabel } from "./shift-calendar";

const shift = (name: string, startsAt: string, endsAt: string) => ({ name, startsAt, endsAt, state: "scheduled" as const });

describe("shift calendar", () => {
  it("files an instant under its site-time day, not the viewer's", () => {
    expect(siteDate("2025-04-23T22:30:00.000Z")).toBe("2025-04-24");
    expect(siteDate("2025-04-24T06:00:00+02:00")).toBe("2025-04-24");
  });

  it("does day and month arithmetic across boundaries", () => {
    expect(addDays("2025-04-30", 1)).toBe("2025-05-01");
    expect(addDays("2025-03-01", -1)).toBe("2025-02-28");
    expect(addMonths("2025-12-15", 1)).toBe("2026-01-01");
    expect(addMonths("2025-01-31", -1)).toBe("2024-12-01");
  });

  it("starts weeks on Monday", () => {
    expect(startOfWeek("2025-04-24")).toBe("2025-04-21"); // Thursday
    expect(startOfWeek("2025-04-27")).toBe("2025-04-21"); // Sunday
    expect(startOfWeek("2025-04-21")).toBe("2025-04-21");
    expect(weekDays("2025-04-24")).toHaveLength(7);
    expect(weekDays("2025-04-24")[6]).toBe("2025-04-27");
  });

  it("builds whole weeks for a month", () => {
    const april = monthGrid("2025-04-24");
    expect(april).toHaveLength(35);
    expect(april[0]).toBe("2025-03-31");
    expect(april.at(-1)).toBe("2025-05-04");
    expect(april.filter((day) => isSameMonth(day, "2025-04-01"))).toHaveLength(30);
    expect(monthGrid("2025-06-10")).toHaveLength(42);
    expect(monthGrid("2027-02-01")).toHaveLength(28);
  });

  it("groups shifts under the day they start, earliest first, and flags overnight ones", () => {
    const grouped = shiftsByDay([
      shift("Shift B", "2025-04-24T14:00:00+02:00", "2025-04-24T22:00:00+02:00"),
      shift("Shift C", "2025-04-24T22:00:00+02:00", "2025-04-25T06:00:00+02:00"),
      shift("Shift A", "2025-04-24T06:00:00+02:00", "2025-04-24T14:00:00+02:00"),
    ]);
    expect([...grouped.keys()]).toEqual(["2025-04-24"]);
    expect(grouped.get("2025-04-24")?.map((item) => item.name)).toEqual(["Shift A", "Shift B", "Shift C"]);
    expect(endsNextDay(shift("C", "2025-04-24T22:00:00+02:00", "2025-04-25T06:00:00+02:00"))).toBe(true);
    expect(endsNextDay(shift("A", "2025-04-24T06:00:00+02:00", "2025-04-24T14:00:00+02:00"))).toBe(false);
  });

  it("labels days, months and weeks", () => {
    expect(monthLabel("2025-04-24")).toMatch(/April 2025/);
    expect(dayLabel("2025-04-24")).toBe("Thursday 24 April 2025");
    expect(weekLabel("2025-04-24")).toBe("21 April – 27 April 2025");
  });

  it("finds the shifts running on a day, including one that began the evening before", () => {
    const shifts = [
      shift("Shift C", "2025-04-23T22:00:00+02:00", "2025-04-24T06:00:00+02:00"),
      shift("Shift A", "2025-04-24T06:00:00+02:00", "2025-04-24T14:00:00+02:00"),
      shift("Shift D", "2025-04-24T22:00:00+02:00", "2025-04-25T06:00:00+02:00"),
    ];
    expect(shiftsOnDay(shifts, "2025-04-24").map((item) => item.name)).toEqual(["Shift C", "Shift A", "Shift D"]);
    expect(shiftsOnDay(shifts, "2025-04-25").map((item) => item.name)).toEqual(["Shift D"]);
    expect(shiftsOnDay(shifts, "2025-04-22")).toEqual([]);
  });

  it("places a shift on a 24-hour day and marks what carries over", () => {
    const morning = dayBlock(shift("A", "2025-04-24T06:00:00+02:00", "2025-04-24T14:00:00+02:00"), "2025-04-24");
    expect(morning.top).toBeCloseTo(25);
    expect(morning.height).toBeCloseTo(33.33, 1);
    expect(morning.continuesFromPrevious || morning.continuesToNext).toBe(false);
    const night = shift("C", "2025-04-24T22:00:00+02:00", "2025-04-25T06:00:00+02:00");
    expect(dayBlock(night, "2025-04-24").continuesToNext).toBe(true);
    expect(dayBlock(night, "2025-04-24").height).toBeCloseTo(8.33, 1);
    const next = dayBlock(night, "2025-04-25");
    expect(next.continuesFromPrevious).toBe(true);
    expect(next.top).toBe(0);
    expect(next.height).toBeCloseTo(25);
  });

  it("positions an instant within its day", () => {
    expect(dayPosition("2025-04-24T12:00:00+02:00", "2025-04-24")).toBeCloseTo(50);
    expect(dayPosition("2025-04-25T01:00:00+02:00", "2025-04-24")).toBeNull();
  });
});
