import type { Shift } from "@vesper/api-contracts";

/**
 * Calendar arithmetic for shift planning. Dates are "YYYY-MM-DD" strings in site time (UTC+2), so a
 * shift is always filed under the day it starts, however the viewer's own clock is set.
 */
const SITE_OFFSET_MS = 2 * 3_600_000;
const DAY_MS = 86_400_000;

const parse = (date: string) => Date.parse(`${date}T12:00:00Z`);
const format = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The site-time calendar day an instant falls on. */
export function siteDate(iso: string) {
  return new Date(Date.parse(iso) + SITE_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  return format(parse(date) + days * DAY_MS);
}

/** The Monday of the week a day belongs to. */
export function startOfWeek(date: string) {
  const weekday = new Date(parse(date)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

export function weekDays(date: string) {
  const first = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

export function startOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

/** The first day of the month `months` away from the one `date` is in. */
export function addMonths(date: string, months: number) {
  const [year, month] = date.slice(0, 7).split("-").map(Number) as [number, number];
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
}

/** Every day shown for a month, whole Monday-to-Sunday weeks, with the days of neighbouring months that fill them. */
export function monthGrid(date: string) {
  const first = startOfMonth(date);
  const last = addDays(addMonths(first, 1), -1);
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 6);
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

export function isSameMonth(day: string, reference: string) {
  return day.slice(0, 7) === reference.slice(0, 7);
}

type Plannable = Pick<Shift, "startsAt" | "endsAt" | "state" | "name">;

/** Shifts grouped by the day they start, earliest first within each day. */
export function shiftsByDay<T extends Plannable>(shifts: T[]) {
  const days = new Map<string, T[]>();
  for (const shift of [...shifts].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.name.localeCompare(b.name))) {
    const day = siteDate(shift.startsAt);
    days.set(day, [...(days.get(day) ?? []), shift]);
  }
  return days;
}

/** True for a shift that ends on a later calendar day than it starts, such as 22:00 to 06:00. */
export function endsNextDay(shift: Pick<Shift, "startsAt" | "endsAt">) {
  return siteDate(shift.endsAt) !== siteDate(shift.startsAt);
}

const label = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", ...options });
const monthFormat = label({ month: "long", year: "numeric" });
const longFormat = label({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortFormat = label({ day: "numeric", month: "long" });
const weekdayFormat = label({ weekday: "short" });
const weekdayLongFormat = label({ weekday: "long" });

export const monthLabel = (date: string) => monthFormat.format(parse(date));
export const dayLabel = (date: string) => longFormat.format(parse(date)).replace(/,/g, "");
export const shortDayLabel = (date: string) => shortFormat.format(parse(date));
export const weekdayLabel = (date: string) => weekdayFormat.format(parse(date)).replace(/\./g, "");
export const weekdayName = (date: string) => weekdayLongFormat.format(parse(date));
export const dayNumber = (date: string) => String(Number(date.slice(8, 10)));

/** "Week of 21 April – 27 April 2025". */
export function weekLabel(date: string) {
  const days = weekDays(date);
  const first = days[0] as string;
  const last = days[6] as string;
  return `${shortDayLabel(first)} – ${shortDayLabel(last)} ${last.slice(0, 4)}`;
}

/** The first instant of a site-time day. */
export function dayStart(date: string) {
  return Date.parse(`${date}T00:00:00+02:00`);
}

/** Every shift that is running at some point on a day, including an overnight one that began the evening before. */
export function shiftsOnDay<T extends Pick<Shift, "startsAt" | "endsAt">>(shifts: T[], date: string) {
  const start = dayStart(date);
  const end = start + DAY_MS;
  return shifts.filter((shift) => Date.parse(shift.startsAt) < end && Date.parse(shift.endsAt) > start).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/** Where a shift sits on a 24-hour day, as percentages, and whether it carries on beyond either edge. */
export function dayBlock(shift: Pick<Shift, "startsAt" | "endsAt">, date: string) {
  const start = dayStart(date);
  const end = start + DAY_MS;
  const from = Math.max(Date.parse(shift.startsAt), start);
  const to = Math.min(Date.parse(shift.endsAt), end);
  return {
    top: ((from - start) / DAY_MS) * 100,
    height: ((to - from) / DAY_MS) * 100,
    continuesFromPrevious: Date.parse(shift.startsAt) < start,
    continuesToNext: Date.parse(shift.endsAt) > end,
  };
}

/** How far through a site-time day an instant is, as a percentage, or null when it is on another day. */
export function dayPosition(iso: string, date: string) {
  const offset = Date.parse(iso) - dayStart(date);
  return offset >= 0 && offset < DAY_MS ? (offset / DAY_MS) * 100 : null;
}
