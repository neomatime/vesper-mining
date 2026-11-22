/**
 * Automations: simple "when this is true, tell this person" rules over records VESPER already holds. There are seven, from a fixed
 * list, and the Mine Manager switches each on or off, chooses who is told and, where it applies, how early or late the rule counts.
 *
 * They only notify. A rule never changes an issue, a shipment, a handover or any other record, never approves or sends anything,
 * and tells nobody outside VESPER: in this prototype a notification is a record in the person's notification list. A rule fires once
 * for each record and stops until the condition has cleared, so the same problem is not announced on every run.
 *
 * Rules run when the Mine Manager presses Run now (there is no background scheduler in this build). Each run is kept in a history.
 */
import type { OperationalIssue } from "@vesper/api-contracts";
import type { EquipmentView } from "./equipment-rules";
import { activeActions, isOpen } from "./issue-rules";
import type { ShiftView } from "./shift-rules";
import type { Shipment } from "@vesper/api-contracts";
import type { FleetAlert } from "./fleet-rules";
import type { ServiceProvider } from "@vesper/api-contracts";

export type AutomationKey = "service_due" | "issue_no_owner" | "overdue_actions" | "handover_draft" | "shipment_waiting" | "fleet_breakdown" | "provider_approval";

/** Who can be told. "owner" is the person who owns the record that triggered the rule. */
export const recipientRoles = ["Mine Manager", "Maintenance Planner", "Shift Supervisor", "Stores / Inventory Controller"] as const;
export type AutomationRecipient = (typeof recipientRoles)[number] | "owner";

export type AutomationDefinition = {
  key: AutomationKey;
  name: string;
  /** One plain sentence: when it fires. */
  description: string;
  /** Who is told by default, and who may be chosen instead. */
  recipient: AutomationRecipient;
  /** Whether "owner" makes sense for this rule (the record has an owner). */
  hasOwner: boolean;
  threshold: { label: string; unit: string; default: number; min: number; max: number } | null;
};

export const automationCatalogue: AutomationDefinition[] = [
  { key: "service_due", name: "Service due soon or overdue", description: "A maintenance plan is overdue, or due within the days you choose.", recipient: "Maintenance Planner", hasOwner: false, threshold: { label: "Tell me this many days ahead", unit: "days", default: 7, min: 1, max: 60 } },
  { key: "issue_no_owner", name: "Issue with no owner", description: "An open issue has had no owner for longer than the hours you choose.", recipient: "Mine Manager", hasOwner: false, threshold: { label: "After", unit: "hours", default: 4, min: 1, max: 72 } },
  { key: "overdue_actions", name: "Overdue action", description: "A corrective action on an open issue has passed its deadline.", recipient: "owner", hasOwner: true, threshold: null },
  { key: "handover_draft", name: "Handover not sent", description: "A shift is about to end, or has ended, and its handover is still a draft.", recipient: "owner", hasOwner: true, threshold: { label: "Within", unit: "hours of the end", default: 2, min: 1, max: 12 } },
  { key: "shipment_waiting", name: "Shipment waiting on transport", description: "A shipment's transport is unconfirmed or declined and its collection date is near.", recipient: "Stores / Inventory Controller", hasOwner: false, threshold: { label: "Within", unit: "days of collection", default: 2, min: 0, max: 14 } },
  { key: "fleet_breakdown", name: "Vehicle problem on a planned load", description: "A vehicle on an own-fleet load is unavailable, overdue for service or has an open issue.", recipient: "owner", hasOwner: true, threshold: null },
  { key: "provider_approval", name: "Provider approval ending", description: "A service provider's approval has expired or ends within the days you choose.", recipient: "Mine Manager", hasOwner: false, threshold: { label: "Tell me this many days ahead", unit: "days", default: 30, min: 1, max: 180 } },
];

export const definitionOf = (key: string) => automationCatalogue.find((item) => item.key === key);

/** One rule as the Mine Manager has set it. */
export type AutomationRule = {
  key: AutomationKey;
  enabled: boolean;
  recipient: AutomationRecipient;
  threshold: number | null;
  lastRunAt: string | null;
  lastFound: number;
  lastNotified: number;
  /** The records this rule has already announced and that still meet its condition. */
  fired: string[];
};

export type AutomationRun = { id: string; at: string; actor: string; kind: "run" | "setting"; ruleKey: AutomationKey | null; found: number; notified: number; summary: string };

export const defaultRules = (): AutomationRule[] =>
  automationCatalogue.map((item) => ({ key: item.key, enabled: false, recipient: item.recipient, threshold: item.threshold?.default ?? null, lastRunAt: null, lastFound: 0, lastNotified: 0, fired: [] }));

/** One thing a rule found: the record, what to say, where to send the person, and who owns it. */
export type Finding = { recordKey: string; title: string; detail: string; href: string; owner: string | null };

export type AutomationInputs = {
  now: string;
  issues: OperationalIssue[];
  equipment: EquipmentView[];
  shifts: ShiftView[];
  shipments: Shipment[];
  providers: ServiceProvider[];
  fleetAlerts: { shipment: Shipment; alert: FleetAlert }[];
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** What a rule finds right now. Pure: it reads the records and changes nothing. */
export function evaluate(key: AutomationKey, threshold: number | null, inputs: AutomationInputs): Finding[] {
  const now = Date.parse(inputs.now);
  const today = inputs.now.slice(0, 10);
  switch (key) {
    case "service_due":
      return inputs.equipment
        .filter((item) => !item.retiredAt)
        .flatMap((item) =>
          item.maintenance
            .filter((plan) => plan.state === "overdue" || (plan.state === "due_soon" && (plan.remainingDays === null || plan.remainingDays <= (threshold ?? 7))))
            .map((plan) => ({ recordKey: `${item.id}:${plan.planId}`, title: `${item.code}: ${plan.name}`, detail: `${plan.label}.`, href: `/equipment/${item.id}`, owner: item.responsible })),
        );
    case "issue_no_owner":
      return inputs.issues
        .filter((issue) => isOpen(issue) && !issue.owner && now - Date.parse(issue.reportedAt) >= (threshold ?? 4) * HOUR)
        .map((issue) => ({ recordKey: issue.id, title: `${issue.issueNumber}: no owner`, detail: `${issue.title} has had no owner for ${Math.floor((now - Date.parse(issue.reportedAt)) / HOUR)} hours.`, href: `/exceptions/${issue.id}`, owner: null }));
    case "overdue_actions":
      return inputs.issues
        .filter((issue) => isOpen(issue))
        .flatMap((issue) => activeActions(issue).filter((action) => action.state === "overdue").map((action) => ({ recordKey: `${issue.id}:${action.id}`, title: `${issue.issueNumber}: ${action.title}`, detail: `This action is overdue (${action.owner}).`, href: `/exceptions/${issue.id}`, owner: action.owner })));
    case "handover_draft":
      return inputs.shifts
        .filter((shift) => (shift.state === "in_progress" || shift.state === "closed") && shift.handover.state === "draft" && Date.parse(shift.endsAt) - now <= (threshold ?? 2) * HOUR)
        .map((shift) => ({ recordKey: shift.id, title: `${shift.name}: handover not sent`, detail: "The handover is still a draft and the shift is ending or has ended.", href: `/shifts/${shift.id}/handover`, owner: shift.supervisor }));
    case "shipment_waiting":
      return inputs.shipments
        .filter((shipment) => (shipment.state === "waiting" || shipment.state === "declined") && Date.parse(`${shipment.preferredDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`) <= (threshold ?? 2) * DAY)
        .map((shipment) => ({ recordKey: shipment.id, title: `${shipment.number}: transport ${shipment.state === "declined" ? "declined" : "not confirmed"}`, detail: `Collection is planned for ${shipment.preferredDate}.`, href: `/shipments/${shipment.id}`, owner: shipment.fleet.coordinator }));
    case "fleet_breakdown":
      return inputs.fleetAlerts.map(({ shipment, alert }) => ({ recordKey: `${shipment.id}:${alert.loadId}`, title: `${shipment.number}: ${alert.vehicleCode} problem`, detail: alert.reason, href: `/shipments/${shipment.id}`, owner: alert.responsible }));
    case "provider_approval": {
      const limit = Date.parse(`${today}T12:00:00Z`) + (threshold ?? 30) * DAY;
      return inputs.providers
        .filter((provider) => provider.approval === "approved" && provider.approvedUntil && Date.parse(`${provider.approvedUntil}T12:00:00Z`) <= limit)
        .map((provider) => ({ recordKey: provider.id, title: `${provider.name}: approval ${provider.approvedUntil < today ? "expired" : "ending"}`, detail: `Approved until ${provider.approvedUntil}.`, href: `/equipment/providers/${provider.id}`, owner: null }));
    }
  }
}
