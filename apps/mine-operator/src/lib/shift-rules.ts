import type { OperationalIssue, Shift, ShiftState } from "@vesper/api-contracts";
import type { Actor, Check } from "./issue-rules";

export const shiftStateLabels: Record<ShiftState, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  closed: "Closed",
  cancelled: "Cancelled",
};

/** How a shift state reads in a status badge. */
export const shiftTone = { scheduled: "pending", in_progress: "in_progress", closed: "complete", cancelled: "unknown" } as const;

export const handoverLabels = { draft: "Draft", published: "Published", acknowledged: "Acknowledged" } as const;

export type ShiftCapability = "manage" | "run" | "handover" | "acknowledge" | "work";

const MANAGEMENT = ["Mine Manager", "Shift Supervisor"];

/**
 * Who may do what on a shift. Managing shifts is for management roles. Starting and closing, and
 * handing over, belong to the shift's own supervisor or the Mine Manager. Acknowledging belongs to the
 * supervisor of the next shift or the Mine Manager.
 */
export function canActOnShift(
  capability: ShiftCapability,
  actor: Actor,
  shift?: Pick<Shift, "supervisor" | "work">,
  next?: Pick<Shift, "supervisor"> | null,
): Check {
  const isManager = actor.role === "Mine Manager";
  switch (capability) {
    case "manage":
      return MANAGEMENT.includes(actor.role)
        ? { allowed: true }
        : { allowed: false, reason: "Shifts are managed by a Shift Supervisor or the Mine Manager." };
    case "run":
      return isManager || (shift?.supervisor && shift.supervisor === actor.name)
        ? { allowed: true }
        : { allowed: false, reason: "Only this shift's supervisor or the Mine Manager can start or close it." };
    case "handover":
      return isManager || (shift?.supervisor && shift.supervisor === actor.name)
        ? { allowed: true }
        : { allowed: false, reason: "The handover belongs to this shift's supervisor or the Mine Manager." };
    case "acknowledge":
      return isManager || (next?.supervisor && next.supervisor === actor.name)
        ? { allowed: true }
        : { allowed: false, reason: "The incoming supervisor (next shift) or the Mine Manager acknowledges the handover." };
    case "work":
      return MANAGEMENT.includes(actor.role) || (shift?.work.some((item) => item.owner === actor.name) ?? false)
        ? { allowed: true }
        : { allowed: false, reason: "Work is updated by the shift's supervisors or the person it is assigned to." };
  }
}

const HOUR = 3_600_000;

export function shiftsOverlap(a: Pick<Shift, "startsAt" | "endsAt">, b: Pick<Shift, "startsAt" | "endsAt">) {
  return Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);
}

/** Turns a date and two clock times (site time) into start and end instants. An end at or before the start means the next day. */
export function buildShiftTimes(date: string, start: string, end: string) {
  const startsAt = `${date}T${start}:00+02:00`;
  let endMs = Date.parse(`${date}T${end}:00+02:00`);
  if (endMs <= Date.parse(startsAt)) endMs += 24 * HOUR;
  const endsAt = new Date(endMs + 2 * HOUR).toISOString().replace(/\.\d{3}Z$/, "+02:00");
  return { startsAt, endsAt };
}

export function shiftHours(shift: Pick<Shift, "startsAt" | "endsAt">) {
  return (Date.parse(shift.endsAt) - Date.parse(shift.startsAt)) / HOUR;
}

/** Everyone on a shift, supervisor included. */
export function peopleOn(shift: Pick<Shift, "supervisor" | "crew">) {
  return [shift.supervisor, ...shift.crew.map((member) => member.name)].filter((name): name is string => Boolean(name));
}

export function isLive(shift: Pick<Shift, "state">) {
  return shift.state === "scheduled" || shift.state === "in_progress";
}

/** A shift as the screens see it, joined to the work it carries forward and its neighbours. */
export type ShiftView = Shift & {
  /** Open issues and open dependencies that continue past this shift. */
  unresolved: number;
  issues: OperationalIssue[];
  next: { id: string; name: string; supervisor: string | null } | null;
  previous: { id: string; name: string } | null;
};

export const crewDuties = ["Operator", "Driver", "Drill operator", "Blast crew", "Maintenance crew", "Stores", "Contractor", "Observer"];
