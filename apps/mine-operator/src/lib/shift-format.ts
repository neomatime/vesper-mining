import type { Shift } from "@vesper/api-contracts";
import { formatDemoTime } from "./demo-clock";

const dayFormatter = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short" });

/** "Thu, 24 Apr" in site time. */
export function formatDay(iso: string) {
  return dayFormatter.format(new Date(iso)).replace(/\./g, "");
}

/** "06:00–14:00". */
export function shiftTimes(shift: Pick<Shift, "startsAt" | "endsAt">) {
  return `${formatDemoTime(shift.startsAt)}–${formatDemoTime(shift.endsAt)}`;
}

/** Splits an instant into the date and time fields a form needs, in site time. */
export function toDateTimeParts(iso: string) {
  const shifted = new Date(Date.parse(iso) + 2 * 3_600_000).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

/** Time left as "5h 13m", never negative. */
export function remaining(until: string, now: string) {
  const minutes = Math.max(0, Math.round((Date.parse(until) - Date.parse(now)) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${String(minutes % 60).padStart(2, "0")}m` : `${minutes}m`;
}

/** Proposes the next shift: the letter after the last one, starting when it ends and running eight hours. */
export function suggestNextShift(shifts: Pick<Shift, "name" | "startsAt" | "endsAt" | "state">[]) {
  const live = shifts.filter((shift) => shift.state !== "cancelled").sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt));
  const last = live.at(-1);
  if (!last) return { name: "Shift A", date: "", start: "06:00", end: "14:00" };
  const letter = /Shift ([A-Z])$/.exec(last.name)?.[1];
  const name = letter ? `Shift ${String.fromCharCode(((letter.charCodeAt(0) - 64) % 3) + 65)}` : "";
  const { date, time } = toDateTimeParts(last.endsAt);
  const end = toDateTimeParts(new Date(Date.parse(last.endsAt) + 8 * 3_600_000).toISOString());
  return { name, date, start: time, end: end.time };
}
