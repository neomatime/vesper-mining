import type { OperationalIssue, ReadinessActivity } from "@vesper/api-contracts";
import { formatDemoDateTime } from "./demo-clock";
import { planTone, type EquipmentView } from "./equipment-rules";
import { needsAttention, readinessLabel, type AttentionItem } from "./needs-attention";
import { remaining, shiftTimes } from "./shift-format";
import { handoverLabels, shiftStateLabels, type ShiftView } from "./shift-rules";

/** The records every role's home is built from. They are the same ones the rest of VESPER uses. */
export type HomeData = {
  issues: OperationalIssue[];
  equipment: EquipmentView[];
  readiness: ReadinessActivity[];
  shifts: ShiftView[];
  now: string;
};

export type HomeRole = "manager" | "supervisor" | "planner" | "stores";

/** Which home a role gets. Anyone not named here sees the manager's view, which is the widest. */
export function homeRole(role: string): HomeRole {
  if (role === "Shift Supervisor") return "supervisor";
  if (role === "Maintenance Planner") return "planner";
  if (role === "Stores / Inventory Controller") return "stores";
  return "manager";
}

export type HomeFigure = { label: string; value: string; hint: string };
export type HomeRow = { id: string; title: string; detail: string; href: string; status?: { value: string; label: string } };
export type HomePanel = { id: string; eyebrow: string; title: string; link?: { href: string; label: string }; rows: HomeRow[]; empty: string };
export type HomeLead = {
  eyebrow: string;
  chip: string;
  title: string;
  description: string;
  facts: { label: string; value: string }[];
  action: { href: string; label: string };
  note: string;
};
export type HomeModel = { eyebrow: string; subtitle: (site: string) => string; lead: HomeLead; nextUp: AttentionItem[]; figures: HomeFigure[]; panels: HomePanel[] };

const count = (value: number) => String(value);

function leadFromItem(eyebrow: string, item: AttentionItem, facts: HomeLead["facts"], description = item.reason): HomeLead {
  return { eyebrow, chip: item.statusLabel, title: item.title, description, facts, action: { href: item.href, label: item.action }, note: "Opens the record. Nothing changes until you act." };
}

function partCount(part: ReadinessActivity["parts"][number]) {
  return `${part.required} needed, ${part.onHand === null ? "stock not confirmed" : `${part.onHand} on hand`}`;
}

function partLine(part: ReadinessActivity["parts"][number]) {
  return `${part.name}: ${partCount(part)}`;
}

/* ------------------------------------------------------------------------------------------------ Shift Supervisor */

export function supervisorHome(data: HomeData, name: string): HomeModel {
  const live = data.shifts.filter((shift) => shift.state === "in_progress" || shift.state === "scheduled");
  const mine = live.filter((shift) => shift.supervisor === name).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const shift = mine.find((item) => item.state === "in_progress") ?? mine[0] ?? live.find((item) => item.state === "in_progress") ?? live[0];

  const nextUp = needsAttention(data, {}, { weights: { handover: 1.4, readiness: 0.4, service: 0.4 } })
    .filter((item) => !shift || item.id !== `handover-${shift.id}`)
    .slice(0, 2);

  if (!shift) {
    return {
      eyebrow: "Shift control",
      subtitle: (site) => `No shift is running at ${site} right now.`,
      lead: { eyebrow: "Your shift", chip: "None running", title: "No shift to run right now", description: "When a shift is scheduled for you, its crew, work and handover appear here.", facts: [], action: { href: "/shifts", label: "See shifts" }, note: "Opens the shift list." },
      nextUp,
      figures: [],
      panels: [],
    };
  }

  const done = shift.work.filter((item) => item.done).length;
  const running = shift.state === "in_progress";
  const timeLeft = running ? remaining(shift.endsAt, data.now) : formatDemoDateTime(shift.startsAt);
  const draft = running && shift.handover.state === "draft";
  const unit = (id: string | null) => data.equipment.find((item) => item.id === id);

  return {
    eyebrow: `Shift control · ${shift.name}`,
    subtitle: (site) => `Here is your shift at ${site}.`,
    lead: {
      eyebrow: "Your shift",
      chip: shiftStateLabels[shift.state],
      title: `${shift.name} · ${shiftTimes(shift)}`,
      description: shift.briefing ?? "Plan the crew and the work, then hand over cleanly to the next shift.",
      facts: [
        { label: running ? "Time left" : "Starts", value: timeLeft },
        { label: "Crew", value: count(shift.crew.length) },
        { label: "Tasks done", value: `${done} of ${shift.work.length}` },
      ],
      action: draft ? { href: `/shifts/${shift.id}/handover`, label: "Write the handover" } : { href: `/shifts/${shift.id}`, label: "Open the shift" },
      note: draft ? "The next supervisor needs the handover before this shift ends." : "Opens the shift record.",
    },
    nextUp,
    figures: [
      { label: running ? "Time left" : "Starts", value: timeLeft, hint: shiftTimes(shift) },
      { label: "Crew on shift", value: count(shift.crew.length), hint: shift.crew.length === 0 ? "Add the crew" : "Including you" },
      { label: "Tasks done", value: `${done} of ${shift.work.length}`, hint: shift.work.length === 0 ? "No work planned" : "Work for this shift" },
      { label: "Carried to next shift", value: count(shift.unresolved), hint: "Open issues and dependencies" },
      { label: "Handover", value: handoverLabels[shift.handover.state], hint: shift.next ? `To ${shift.next.name}` : "No next shift yet" },
    ],
    panels: [
      {
        id: "crew",
        eyebrow: "People",
        title: "Crew on this shift",
        link: { href: `/shifts/${shift.id}`, label: "Manage crew" },
        empty: "No one is on this shift yet. Add the crew from the shift record.",
        rows: shift.crew.map((member) => ({
          id: member.id,
          title: member.name,
          detail: `${member.duty}${unit(member.equipmentId) ? ` · ${unit(member.equipmentId)?.code}` : ""}`,
          href: `/shifts/${shift.id}`,
        })),
      },
      {
        id: "work",
        eyebrow: "Work",
        title: "Work for this shift",
        link: { href: `/shifts/${shift.id}`, label: "Open work" },
        empty: "No work is planned for this shift yet.",
        rows: shift.work.map((item) => ({
          id: item.id,
          title: item.title,
          detail: item.owner ?? "No owner yet",
          href: item.issueId ? `/exceptions/${item.issueId}` : `/shifts/${shift.id}`,
          status: item.done ? { value: "complete", label: "Done" } : { value: running ? "in_progress" : "pending", label: running ? "To do" : "Planned" },
        })),
      },
    ],
  };
}

/* ------------------------------------------------------------------------------------------- Maintenance Planner */

const planOrder = { overdue: 0, due_soon: 1, ok: 2, unknown: 3 } as const;
const planLabel = { overdue: "Overdue", due_soon: "Due soon", ok: "On plan", unknown: "Not known" } as const;

export function plannerHome(data: HomeData): HomeModel {
  const units = data.equipment;
  const withPlan = units.filter((unit) => unit.nextService);
  const overdue = withPlan.filter((unit) => unit.nextService?.state === "overdue");
  const dueSoon = withPlan.filter((unit) => unit.nextService?.state === "due_soon");
  const down = units.filter((unit) => unit.state === "unavailable");
  const risks = data.readiness.filter((item) => item.status !== "ready");
  const available = units.length - down.length;

  const items = needsAttention(data, {}, { weights: { handover: 0 }, issueFilter: (issue) => issue.equipmentId !== null });
  const [first, ...rest] = items;
  const facts = [
    { label: "Services overdue", value: count(overdue.length) },
    { label: "Due soon", value: count(dueSoon.length) },
    { label: "Units down", value: count(down.length) },
  ];

  return {
    eyebrow: "Equipment & maintenance",
    subtitle: (site) => `Here is what needs maintenance attention at ${site}.`,
    lead: first
      ? leadFromItem("Maintenance", first, facts)
      : { eyebrow: "Maintenance", chip: "On plan", title: "Maintenance is on plan", description: "No service is overdue or due soon, and every unit is available.", facts, action: { href: "/equipment", label: "Open equipment" }, note: "Opens the equipment register." },
    nextUp: rest.slice(0, 2),
    figures: [
      { label: "Equipment available", value: units.length ? `${Math.round((available / units.length) * 100)}%` : "—", hint: `${available} of ${units.length} units` },
      { label: "Services overdue", value: count(overdue.length), hint: overdue.length ? "Plan these first" : "None overdue" },
      { label: "Due soon", value: count(dueSoon.length), hint: "Within the warning window" },
      { label: "Units down", value: count(down.length), hint: down.length ? "Reported unavailable" : "All available" },
      { label: "Readiness risks", value: count(risks.length), hint: "Work waiting on parts" },
    ],
    panels: [
      {
        id: "services",
        eyebrow: "Planned work",
        title: "Services coming up",
        link: { href: "/equipment", label: "All equipment" },
        empty: "No maintenance plans are set up yet.",
        rows: [...withPlan]
          .sort((a, b) => planOrder[a.nextService?.state ?? "unknown"] - planOrder[b.nextService?.state ?? "unknown"] || (a.nextService?.remainingDays ?? 999) - (b.nextService?.remainingDays ?? 999))
          .slice(0, 6)
          .map((unit) => ({
            id: unit.id,
            title: `${unit.code} · ${unit.nextService?.name ?? ""}`,
            detail: unit.nextService?.label ?? "",
            href: `/equipment/${unit.id}`,
            status: { value: planTone[unit.nextService?.state ?? "unknown"], label: planLabel[unit.nextService?.state ?? "unknown"] },
          })),
      },
      {
        id: "down",
        eyebrow: "Availability",
        title: "Equipment that is down",
        link: { href: "/equipment", label: "Open equipment" },
        empty: "Every unit is available.",
        rows: down.map((unit) => ({ id: unit.id, title: `${unit.code} · ${unit.name}`, detail: unit.stateNote ?? "No note recorded", href: `/equipment/${unit.id}`, status: { value: "blocked", label: "Unavailable" } })),
      },
    ],
  };
}

/* ---------------------------------------------------------------------------------------------------- Stores */

export function storesHome(data: HomeData): HomeModel {
  const activities = data.readiness;
  const risks = activities.filter((item) => item.status !== "ready");
  const byStatus = (status: ReadinessActivity["status"]) => activities.filter((item) => item.status === status).length;

  const items = needsAttention(data, {}, { weights: { issue: 0, handover: 0, service: 0 } });
  const [first, ...rest] = items;
  const firstActivity = first ? activities.find((item) => `readiness-${item.id}` === first.id) : undefined;
  const firstPart = firstActivity?.parts.find((part) => part.onHand === null || part.onHand < part.required) ?? firstActivity?.parts[0];
  const facts = [
    { label: "Needs confirming", value: count(byStatus("needs_confirmation")) },
    { label: "Possible shortage", value: count(byStatus("potential_shortage")) },
    { label: "Overdue", value: count(byStatus("overdue")) },
  ];

  const partRows: HomeRow[] = [...risks]
    .sort((a, b) => Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor))
    .flatMap((activity) =>
      activity.parts.map((part) => ({
        id: `${activity.id}-${part.id}`,
        title: part.name,
        detail: `${partCount(part)} · for ${activity.title}`,
        href: `/resources/${activity.id}`,
        status: part.onHand === null ? { value: "unknown", label: "Stock not confirmed" } : part.onHand >= part.required ? { value: "complete", label: "Enough" } : { value: "at_risk", label: "Short" },
      })),
    )
    .slice(0, 8);

  return {
    eyebrow: "Parts & stock",
    subtitle: (site) => `Here is the stock that needs checking at ${site}.`,
    lead: first
      ? leadFromItem("Stock", first, facts, firstPart ? `${first.reason} ${partLine(firstPart)}.` : first.reason)
      : { eyebrow: "Stock", chip: "Ready", title: "Every part is accounted for", description: "No planned work is waiting on stock, and nothing needs confirming.", facts, action: { href: "/resources", label: "Open readiness" }, note: "Opens the readiness list." },
    nextUp: rest.slice(0, 2),
    figures: [
      { label: "Readiness risks", value: count(risks.length), hint: risks.length ? "Planned work waiting on stock" : "None" },
      { label: "Needs confirming", value: count(byStatus("needs_confirmation")), hint: "Stock level unconfirmed" },
      { label: "Possible shortage", value: count(byStatus("potential_shortage")), hint: "May run short before due" },
      { label: "Inbound to review", value: count(byStatus("review_inbound")), hint: "Stock on its way" },
      { label: "Ready", value: count(byStatus("ready")), hint: "Parts in hand" },
    ],
    panels: [
      { id: "parts", eyebrow: "Parts", title: "Parts to check", link: { href: "/resources", label: "All readiness" }, empty: "Nothing needs checking.", rows: partRows },
      {
        id: "upcoming",
        eyebrow: "Schedule",
        title: "Planned work coming up",
        link: { href: "/resources", label: "Open readiness" },
        empty: "No planned work is scheduled.",
        rows: [...activities]
          .sort((a, b) => Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor))
          .slice(0, 5)
          .map((activity) => ({ id: activity.id, title: activity.title, detail: `Scheduled ${formatDemoDateTime(activity.scheduledFor)}`, href: `/resources/${activity.id}`, status: { value: activity.status, label: readinessLabel[activity.status] } })),
      },
    ],
  };
}
