import type { DowntimeReason, Equipment, EquipmentCategory, IssueWorkflowState, MaintenancePlan, ReadinessActivity } from "@vesper/api-contracts";
import type { Actor, Check } from "./issue-rules";

export const categoryLabels: Record<EquipmentCategory, string> = {
  excavator: "Excavator",
  haul_truck: "Haul truck",
  dozer: "Dozer",
  loader: "Loader",
  drill_rig: "Drill rig",
  crusher: "Crusher",
  water_cart: "Water cart",
  light_vehicle: "Light vehicle",
  pump: "Pump",
  other: "Other",
};

export const categories = Object.keys(categoryLabels) as EquipmentCategory[];

export type EquipmentCapability = "manage" | "service" | "reading" | "state";

const permissions: Record<EquipmentCapability, { roles: string[]; message: string }> = {
  manage: {
    roles: ["Mine Manager", "Maintenance Planner"],
    message: "Adding, editing and retiring equipment is done by the Mine Manager or the Maintenance Planner.",
  },
  service: {
    roles: ["Mine Manager", "Maintenance Planner", "Shift Supervisor"],
    message: "Service entries are logged by the Mine Manager, Maintenance Planner or Shift Supervisor.",
  },
  reading: {
    roles: ["Mine Manager", "Maintenance Planner", "Shift Supervisor", "Field Employee"],
    message: "Meter readings are recorded by operations and maintenance roles.",
  },
  state: {
    roles: ["Mine Manager", "Maintenance Planner", "Shift Supervisor"],
    message: "Availability is reported by the Mine Manager, Maintenance Planner or Shift Supervisor.",
  },
};

export function canActOnEquipment(capability: EquipmentCapability, actor: Actor): Check {
  const rule = permissions[capability];
  return rule.roles.includes(actor.role) ? { allowed: true } : { allowed: false, reason: rule.message };
}

/** Asset codes are short, upper case and unique, for example EX-204. */
export function normaliseCode(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, "-");
}

export function isValidCode(code: string) {
  return /^[A-Z0-9][A-Z0-9-]{1,13}$/.test(code);
}

export type PlanState = "ok" | "due_soon" | "overdue" | "unknown";

export type PlanStatus = {
  planId: string;
  name: string;
  basis: "hours" | "days";
  state: PlanState;
  /** Short label for tables, for example "Due in 20 days". */
  label: string;
  /** Fuller explanation for the plan row. */
  detail: string;
  remainingHours: number | null;
  remainingDays: number | null;
  dueAt: string | null;
};

const DAY = 86_400_000;

const plural = (value: number, word: string) => `${value.toLocaleString("en-GB")} ${word}${value === 1 ? "" : "s"}`;

/**
 * Time to the next service, using the PRD's formulas:
 * hours remaining = next service threshold minus current verified hours,
 * days remaining = hours remaining divided by average hours per day.
 * When the readings are missing the status says so instead of guessing.
 */
export function planStatus(
  plan: MaintenancePlan,
  equipment: Pick<Equipment, "hours" | "hoursPerDay">,
  now: string,
): PlanStatus {
  const base = { planId: plan.id, name: plan.name, basis: plan.basis };

  if (plan.basis === "hours") {
    if (equipment.hours === null || plan.lastServiceHours === null) {
      return {
        ...base,
        state: "unknown",
        label: "Cannot be worked out yet",
        detail: "Record the current meter reading and the hours at the last service to see when this is due.",
        remainingHours: null,
        remainingDays: null,
        dueAt: null,
      };
    }
    const remaining = Math.round((plan.lastServiceHours + plan.interval - equipment.hours) * 10) / 10;
    const days = equipment.hoursPerDay ? remaining / equipment.hoursPerDay : null;
    const dueAt = days !== null && remaining > 0 ? new Date(Date.parse(now) + days * DAY).toISOString() : null;

    if (remaining <= 0) {
      return {
        ...base,
        state: "overdue",
        label: remaining === 0 ? "Due now" : `Overdue by ${plural(Math.abs(remaining), "hour")}`,
        detail: `This was due at ${(plan.lastServiceHours + plan.interval).toLocaleString("en-GB")} hours.`,
        remainingHours: remaining,
        remainingDays: null,
        dueAt: null,
      };
    }
    const soon = remaining <= plan.interval * 0.1;
    const estimate = days !== null ? `, about ${plural(Math.max(1, Math.round(days)), "day")} at ${equipment.hoursPerDay} hours a day` : "";
    return {
      ...base,
      state: soon ? "due_soon" : "ok",
      label: days !== null ? `Due in ${plural(Math.max(1, Math.round(days)), "day")}` : `Due in ${plural(remaining, "hour")}`,
      detail: `${plural(remaining, "hour")} remaining${estimate}.`,
      remainingHours: remaining,
      remainingDays: days !== null ? Math.round(days) : null,
      dueAt,
    };
  }

  if (plan.lastServiceAt === null) {
    return {
      ...base,
      state: "unknown",
      label: "Cannot be worked out yet",
      detail: "Record the date of the last service to see when this is due.",
      remainingHours: null,
      remainingDays: null,
      dueAt: null,
    };
  }
  const dueAt = new Date(Date.parse(plan.lastServiceAt) + plan.interval * DAY).toISOString();
  const remainingDays = Math.ceil((Date.parse(dueAt) - Date.parse(now)) / DAY);
  if (remainingDays < 0) {
    return { ...base, state: "overdue", label: `Overdue by ${plural(Math.abs(remainingDays), "day")}`, detail: "The calendar interval has passed.", remainingHours: null, remainingDays, dueAt };
  }
  return {
    ...base,
    state: remainingDays <= Math.max(7, plan.interval * 0.1) ? "due_soon" : "ok",
    label: remainingDays === 0 ? "Due today" : `Due in ${plural(remainingDays, "day")}`,
    detail: `Every ${plural(plan.interval, "day")}.`,
    remainingHours: null,
    remainingDays,
    dueAt,
  };
}

const urgency: Record<PlanState, number> = { overdue: 0, due_soon: 1, ok: 2, unknown: 3 };

/** The plan that needs attention first. */
export function mostUrgent(statuses: PlanStatus[]): PlanStatus | null {
  if (statuses.length === 0) return null;
  return [...statuses].sort((a, b) => {
    if (urgency[a.state] !== urgency[b.state]) return urgency[a.state] - urgency[b.state];
    return (a.remainingDays ?? Infinity) - (b.remainingDays ?? Infinity);
  })[0];
}

export const stateLabels = { available: "Available", unavailable: "Unavailable" } as const;

export const downtimeReasonLabels: Record<DowntimeReason, string> = {
  mechanical_fault: "Mechanical fault",
  electrical_fault: "Electrical or control fault",
  waiting_parts: "Waiting for parts",
  waiting_contractor: "Waiting for a contractor or team",
  planned_maintenance: "Planned maintenance",
  operating_conditions: "Operating conditions",
  other: "Other",
};
export const downtimeReasons = Object.keys(downtimeReasonLabels) as DowntimeReason[];

/** Maps a plan state onto the shared status marks. */
export const planTone: Record<PlanState, string> = { ok: "on_plan", due_soon: "at_risk", overdue: "blocked", unknown: "unknown" };

/** An equipment record as the screens see it: joined to its area, linked work and maintenance status. */
export type EquipmentView = Equipment & {
  areaName: string | null;
  maintenance: PlanStatus[];
  nextService: PlanStatus | null;
  linkedIssues: { id: string; issueNumber: string; title: string; workflowState: IssueWorkflowState; open: boolean }[];
  readiness: { id: string; title: string; status: ReadinessActivity["status"]; scheduledFor: string }[];
};
