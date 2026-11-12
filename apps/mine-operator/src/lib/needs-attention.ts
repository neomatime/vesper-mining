import type { OperationalIssue, ReadinessActivity } from "@vesper/api-contracts";
import type { EquipmentView } from "./equipment-rules";
import { isOpen } from "./issue-rules";
import type { ShiftView } from "./shift-rules";

/** One thing that needs a person, with the single next step to take. */
export type AttentionItem = {
  id: string;
  kind: "issue" | "readiness" | "service" | "handover";
  title: string;
  reason: string;
  href: string;
  action: string;
  /** The status value shown beside the item, from the shared status system. */
  status: string;
  statusLabel: string;
  /** Higher means more urgent. Only used to order the list. */
  urgency: number;
};

type Inputs = {
  issues: OperationalIssue[];
  readiness: ReadinessActivity[];
  equipment: Pick<EquipmentView, "id" | "code" | "name" | "nextService">[];
  shifts: Pick<ShiftView, "id" | "name" | "state" | "endsAt" | "handover">[];
  now: string;
};

const issueWeight = { critical: 100, high: 80, medium: 50, low: 20 } as const;
const readinessWeight: Record<ReadinessActivity["status"], number> = { overdue: 90, potential_shortage: 75, needs_confirmation: 65, review_inbound: 45, ready: 0 };
const readinessReason: Record<ReadinessActivity["status"], string> = {
  overdue: "This is overdue.",
  potential_shortage: "Parts may run short before this is due.",
  needs_confirmation: "Stock needs confirming before this is due.",
  review_inbound: "Inbound stock needs a review.",
  ready: "",
};
const readinessLabel: Record<ReadinessActivity["status"], string> = { overdue: "Overdue", potential_shortage: "Possible shortage", needs_confirmation: "Needs confirming", review_inbound: "Review inbound", ready: "Ready" };

function minutesSince(iso: string, now: string) {
  return Math.max(0, Math.round((Date.parse(now) - Date.parse(iso)) / 60_000));
}

function age(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} d`;
}

function untilEnd(iso: string, now: string) {
  const minutes = Math.max(0, Math.round((Date.parse(iso) - Date.parse(now)) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${String(minutes % 60).padStart(2, "0")} min` : `${minutes} min`;
}

/**
 * Everything that currently needs a person, most urgent first. The list is built from the same records the
 * rest of VESPER uses, so it can never disagree with them. `exclude` leaves out an item already shown elsewhere.
 */
export function needsAttention({ issues, readiness, equipment, shifts, now }: Inputs, exclude: { issueId?: string } = {}): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const issue of issues) {
    if (!isOpen(issue) || issue.id === exclude.issueId) continue;
    const blocked = issue.operationalStatus === "blocked";
    const waiting = issue.workflowState === "awaiting_dependency";
    items.push({
      id: `issue-${issue.id}`,
      kind: "issue",
      title: issue.title,
      reason: `${issue.owner ? `With ${issue.owner}` : "No owner yet"} · reported ${age(minutesSince(issue.reportedAt, now))} ago`,
      href: `/exceptions/${issue.id}`,
      action: issue.owner ? "Review issue" : "Assign an owner",
      status: blocked ? "blocked" : waiting ? "awaiting_dependency" : issue.operationalStatus,
      statusLabel: blocked ? "Blocked" : waiting ? "Awaiting dependency" : issue.priority === "critical" || issue.priority === "high" ? "High priority" : "Open",
      urgency: issueWeight[issue.priority] + (blocked ? 10 : 0) + (waiting ? 5 : 0) + (issue.owner ? 0 : 6),
    });
  }

  for (const activity of readiness) {
    if (activity.status === "ready") continue;
    const unit = equipment.find((item) => item.id === activity.equipmentId);
    items.push({
      id: `readiness-${activity.id}`,
      kind: "readiness",
      title: activity.title,
      reason: `${unit ? `${unit.code} · ` : ""}${readinessReason[activity.status]}`,
      href: `/resources/${activity.id}`,
      action: "Review readiness",
      status: activity.status,
      statusLabel: readinessLabel[activity.status],
      urgency: readinessWeight[activity.status],
    });
  }

  for (const unit of equipment) {
    const plan = unit.nextService;
    if (!plan || (plan.state !== "overdue" && plan.state !== "due_soon")) continue;
    items.push({
      id: `service-${unit.id}`,
      kind: "service",
      title: `${unit.code} · ${plan.name}`,
      reason: plan.label,
      href: `/equipment/${unit.id}`,
      action: "Plan the service",
      status: plan.state === "overdue" ? "overdue" : "due_soon",
      statusLabel: plan.state === "overdue" ? "Overdue" : "Due soon",
      urgency: plan.state === "overdue" ? 85 : 55,
    });
  }

  for (const shift of shifts) {
    if (shift.state !== "in_progress" || shift.handover.state !== "draft") continue;
    const left = Date.parse(shift.endsAt) - Date.parse(now);
    items.push({
      id: `handover-${shift.id}`,
      kind: "handover",
      title: `${shift.name} handover is not published`,
      reason: `The shift ends in ${untilEnd(shift.endsAt, now)}. The next supervisor needs it.`,
      href: `/shifts/${shift.id}/handover`,
      action: "Write the handover",
      status: "pending",
      statusLabel: "Draft",
      urgency: left <= 2 * 3_600_000 ? 72 : 30,
    });
  }

  return items.sort((a, b) => b.urgency - a.urgency || a.title.localeCompare(b.title));
}
