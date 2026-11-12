import { describe, expect, it } from "vitest";
import { formatDay, remaining, shiftTimes, suggestNextShift, toDateTimeParts } from "./shift-format";

describe("shift formatting", () => {
  it("formats the day and the time range in site time", () => {
    expect(formatDay("2025-04-24T06:00:00+02:00")).toBe("Thu, 24 Apr");
    expect(shiftTimes({ startsAt: "2025-04-24T06:00:00+02:00", endsAt: "2025-04-24T14:00:00+02:00" })).toBe("06:00–14:00");
  });

  it("splits an instant into form fields", () => {
    expect(toDateTimeParts("2025-04-24T22:00:00+02:00")).toEqual({ date: "2025-04-24", time: "22:00" });
  });

  it("shows time left, never negative", () => {
    expect(remaining("2025-04-24T14:00:00+02:00", "2025-04-24T08:47:00+02:00")).toBe("5h 13m");
    expect(remaining("2025-04-24T14:00:00+02:00", "2025-04-24T13:30:00+02:00")).toBe("30m");
    expect(remaining("2025-04-24T14:00:00+02:00", "2025-04-24T15:00:00+02:00")).toBe("0m");
  });
});

describe("suggestNextShift", () => {
  it("continues the cycle from the last shift", () => {
    const next = suggestNextShift([
      { name: "Shift A", startsAt: "2025-04-24T06:00:00+02:00", endsAt: "2025-04-24T14:00:00+02:00", state: "closed" },
      { name: "Shift B", startsAt: "2025-04-24T14:00:00+02:00", endsAt: "2025-04-24T22:00:00+02:00", state: "scheduled" },
    ]);
    expect(next).toEqual({ name: "Shift C", date: "2025-04-24", start: "22:00", end: "06:00" });
  });

  it("ignores cancelled shifts and starts a fresh roster when there are none", () => {
    expect(suggestNextShift([{ name: "Shift B", startsAt: "2025-04-24T14:00:00+02:00", endsAt: "2025-04-24T22:00:00+02:00", state: "cancelled" }]).name).toBe("Shift A");
  });
});
