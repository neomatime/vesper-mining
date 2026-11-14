import { describe, expect, it } from "vitest";
import { downtimePeriods, downtimeWithin, formatDuration } from "./downtime";

const ev = (over: Record<string, unknown>) => ({ type: "state_changed", state: null, reason: null, summary: "", note: null, actor: "Amina Patel", occurredAt: "2025-04-24T08:00:00+02:00", ...over }) as never;
const base = { state: "available" as const, stateNote: null, stateUpdatedAt: "2025-04-24T06:00:00+02:00" };
const now = "2025-04-24T14:00:00+02:00";

describe("downtimePeriods", () => {
  it("pairs an unavailable report with the next available report", () => {
    const periods = downtimePeriods({ ...base, events: [ev({ state: "unavailable", reason: "waiting_parts", note: "Liner worn", occurredAt: "2025-04-24T08:00:00+02:00" }), ev({ state: "available", occurredAt: "2025-04-24T10:30:00+02:00" })] }, now);
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({ minutes: 150, reason: "waiting_parts", reportedBy: "Amina Patel" });
    expect(periods[0]?.end).not.toBeNull();
  });

  it("runs an open period to now", () => {
    const periods = downtimePeriods({ ...base, state: "unavailable", events: [ev({ state: "unavailable", occurredAt: "2025-04-24T12:00:00+02:00" })] }, now);
    expect(periods[0]).toMatchObject({ end: null, minutes: 120 });
  });

  it("reads the state from the wording of older events", () => {
    const periods = downtimePeriods({ ...base, events: [ev({ summary: "Reported unavailable", occurredAt: "2025-04-24T09:00:00+02:00" }), ev({ summary: "Reported available", occurredAt: "2025-04-24T09:45:00+02:00" })] }, now);
    expect(periods[0]?.minutes).toBe(45);
    expect(periods[0]?.reason).toBeNull();
  });

  it("counts equipment that is unavailable with no change on record, from its last state update", () => {
    const periods = downtimePeriods({ state: "unavailable", stateNote: "Feed interruption", stateUpdatedAt: "2025-04-24T08:05:00+02:00", events: [] }, now);
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({ end: null, note: "Feed interruption", reportedBy: "Not recorded" });
    expect(periods[0]?.minutes).toBe(355);
  });

  it("ignores events that are not availability changes", () => {
    expect(downtimePeriods({ ...base, events: [ev({ type: "service_logged", summary: "Service logged" })] }, now)).toEqual([]);
  });
});

describe("downtimeWithin", () => {
  it("clips periods to the window and splits by reason, with unrecorded kept separate", () => {
    const periods = [
      { start: "2025-04-23T20:00:00+02:00", end: "2025-04-24T01:00:00+02:00", minutes: 300, reason: "waiting_parts" as const, note: null, reportedBy: "x" },
      { start: "2025-04-24T08:00:00+02:00", end: null, minutes: 360, reason: null, note: null, reportedBy: "x" },
    ];
    const result = downtimeWithin(periods, "2025-04-24T00:00:00+02:00", "2025-04-24T14:00:00+02:00");
    expect(result.total).toBe(60 + 360);
    expect(result.byReason).toEqual([{ reason: "unrecorded", minutes: 360 }, { reason: "waiting_parts", minutes: 60 }]);
  });
});

describe("formatDuration", () => {
  it("reads naturally", () => {
    expect(formatDuration(43)).toBe("43 min");
    expect(formatDuration(125)).toBe("2 h 05 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(27 * 60)).toBe("1 d 3 h");
  });
});
