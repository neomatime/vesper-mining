import { DEMO_NOW } from "./demo-data";

const MINUTE = 60_000;
const SAST_OFFSET_MS = 2 * 60 * MINUTE;

/** Deterministic fixture clock: the demo "now" plus a number of minutes, as an ISO string in +02:00. */
export function demoTimeAt(offsetMinutes: number): string {
  const shifted = new Date(Date.parse(DEMO_NOW) + offsetMinutes * MINUTE + SAST_OFFSET_MS);
  return shifted.toISOString().replace(/\.\d{3}Z$/, "+02:00");
}

const formatter = new Intl.DateTimeFormat("en-ZA", {
  timeZone: "Africa/Johannesburg",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function parts(iso: string) {
  return Object.fromEntries(formatter.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
}

/** "08:47" in site time. */
export function formatDemoTime(iso: string) {
  const { hour, minute } = parts(iso);
  return `${hour}:${minute}`;
}

/** "24 Apr · 08:47" in site time. */
export function formatDemoDateTime(iso: string) {
  const { day, month, hour, minute } = parts(iso);
  return `${day} ${month} · ${hour}:${minute}`;
}

/** Value for a datetime-local input, in site time. */
export function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const shifted = new Date(Date.parse(iso) + SAST_OFFSET_MS);
  return shifted.toISOString().slice(0, 16);
}

/** Converts a datetime-local value (site time) back to an ISO string with offset. */
export function fromLocalInput(value: string) {
  return value ? `${value}:00+02:00` : null;
}
