import type { DowntimeReason, EquipmentEvent } from "@vesper/api-contracts";

/**
 * Downtime worked out from the availability changes people already report, so nobody keeps a separate log.
 * Every period is as reported: its start and end are the times someone told VESPER, not measured by the machine.
 */
export type DowntimePeriod = {
  start: string;
  /** Null while the equipment is still unavailable. */
  end: string | null;
  minutes: number;
  reason: DowntimeReason | null;
  note: string | null;
  reportedBy: string;
};

type Source = {
  state: "available" | "unavailable";
  stateNote: string | null;
  stateUpdatedAt: string;
  events: Pick<EquipmentEvent, "type" | "state" | "reason" | "summary" | "note" | "actor" | "occurredAt">[];
};

const MINUTE = 60_000;

/** Older events carry no state, so it is read from their wording. */
function stateOf(event: Source["events"][number]): "available" | "unavailable" | null {
  if (event.state) return event.state;
  if (event.type !== "state_changed") return null;
  if (/unavailable/i.test(event.summary)) return "unavailable";
  if (/available/i.test(event.summary)) return "available";
  return null;
}

const minutesBetween = (from: string, to: string) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / MINUTE));

/** Periods of reported unavailability, oldest first. A period still open runs to `now`. */
export function downtimePeriods(item: Source, now: string): DowntimePeriod[] {
  const changes = item.events
    .filter((event) => event.type === "state_changed" && stateOf(event) !== null)
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

  const periods: DowntimePeriod[] = [];
  let open: Omit<DowntimePeriod, "end" | "minutes"> | null = null;
  for (const change of changes) {
    const state = stateOf(change);
    if (state === "unavailable" && !open) {
      open = { start: change.occurredAt, reason: change.reason ?? null, note: change.note, reportedBy: change.actor };
    } else if (state === "available" && open) {
      periods.push({ ...open, end: change.occurredAt, minutes: minutesBetween(open.start, change.occurredAt) });
      open = null;
    }
  }
  if (open) {
    periods.push({ ...open, end: null, minutes: minutesBetween(open.start, now) });
  } else if (item.state === "unavailable") {
    // Reported unavailable with no change event on record (seeded or imported): count from when its state was last updated.
    periods.push({ start: item.stateUpdatedAt, end: null, minutes: minutesBetween(item.stateUpdatedAt, now), reason: null, note: item.stateNote, reportedBy: "Not recorded" });
  }
  return periods;
}

/** Minutes of downtime inside a window, with each period clipped to it, split by reason. */
export function downtimeWithin(periods: DowntimePeriod[], from: string, to: string) {
  const start = Date.parse(from);
  const end = Date.parse(to);
  const byReason = new Map<DowntimeReason | "unrecorded", number>();
  let total = 0;
  for (const period of periods) {
    const a = Math.max(start, Date.parse(period.start));
    const b = Math.min(end, period.end ? Date.parse(period.end) : end);
    if (b <= a) continue;
    const minutes = Math.round((b - a) / MINUTE);
    total += minutes;
    const key = period.reason ?? "unrecorded";
    byReason.set(key, (byReason.get(key) ?? 0) + minutes);
  }
  return { total, byReason: [...byReason].map(([reason, minutes]) => ({ reason, minutes })).sort((x, y) => y.minutes - x.minutes) };
}

/** "43 min", "2 h 05 min", "1 d 3 h". */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} h ${String(rest).padStart(2, "0")} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} d ${hours % 24} h` : `${days} d`;
}
