/**
 * VESPER Intelligence, rules layer. The system calculates and writes plain-language explanations; a person decides.
 *
 * Everything here is deterministic and reads records that already exist (issues, equipment, readiness, shifts, shipments and the Gold
 * impact estimate). It never creates a record of its own, never invents a quantity, rand value or failure probability, and says what
 * it could not work out. Money is only included when the person is allowed to see it. A live language model could later sit in front of
 * the same functions to rephrase the text; the figures and the links would still come from here.
 *
 * Three things are produced:
 *   buildInsights   prioritised "what happened, what is affected, why it matters, what to do", each linked to its source record
 *   buildBriefing   a shift briefing assembled from the shift, its work, its issues and its handover (for a supervisor to review)
 *   answerQuestion  Ask VESPER: a question matched to one of the supported analyses, answered from the same insights and records
 */
import type { CollectionRequest, OperationalIssue, ReadinessActivity, Shipment } from "@vesper/api-contracts";
import { isOpen } from "./issue-rules";
import { formatGrams } from "./impact-rules";
import { formatMoney, shortDate } from "./shipment-rules";
import type { EquipmentView } from "./equipment-rules";
import type { ShiftView } from "./shift-rules";

/** What the Gold demonstration estimate provides, in the shape these rules need. */
export type ImpactInput = {
  scenario: { issueId: string; equipmentId: string; shipmentNumber: string; customer: string; commitmentGrams: number; deliveryDeadline: string };
  result: { assessed: boolean; remainingShortfallGrams: number | null; valueDelayed: number | null; forecastGrams: number | null; missing: string[] };
  canSeeValue: boolean;
  equipment: { name: string; code: string } | null;
};

export type IntelligenceInputs = {
  now: string;
  issues: OperationalIssue[];
  equipment: EquipmentView[];
  readiness: ReadinessActivity[];
  shifts: ShiftView[];
  shipments: Shipment[];
  requests: CollectionRequest[];
  impact: ImpactInput | null;
};

export type Insight = {
  id: string;
  kind: "production" | "shipment" | "equipment" | "readiness";
  /** Short headline, for example "Production at risk". */
  title: string;
  /** One sentence: what is happening and what it affects. */
  summary: string;
  /** Why it matters. */
  why: string;
  action: { label: string; href: string };
  /** Higher is more urgent. Only used to order insights. */
  urgency: number;
  /** The records this insight comes from, so nothing here stands alone. */
  sources: { label: string; href: string }[];
};

// ---- Priorities -----------------------------------------------------------------------------------------------------------

/** How many times an equipment record was reported unavailable. Reliability claims need at least this many events as evidence. */
export const RECURRENCE_THRESHOLD = 2;

export function breakdownCount(equipment: Pick<EquipmentView, "events">): number {
  return equipment.events.filter((event) => event.type === "state_changed" && event.state === "unavailable").length;
}

export function buildInsights(inputs: IntelligenceInputs): Insight[] {
  const insights: Insight[] = [];
  const { impact } = inputs;

  // 1. Production at risk: the Gold delivery estimate, with the deterministic shortfall. Money only for people who may see it.
  if (impact?.result.assessed && (impact.result.remainingShortfallGrams ?? 0) > 0) {
    const shortfall = impact.result.remainingShortfallGrams ?? 0;
    const money = impact.canSeeValue && impact.result.valueDelayed !== null ? ` (estimated sales value potentially delayed: ${formatMoney(impact.result.valueDelayed)})` : "";
    const name = impact.equipment?.name ?? "The breakdown";
    insights.push({
      id: "production-at-risk",
      kind: "production",
      title: "Production at risk",
      summary: `${name} downtime could reduce output by up to ${formatGrams(shortfall)} of gold${money}.`,
      why: `It could leave the ${formatGrams(impact.scenario.commitmentGrams)} gold delivery to ${impact.scenario.customer} short. This is a calculated estimate, not a confirmed loss.`,
      action: { label: "Review impact", href: `/exceptions/${impact.scenario.issueId}` },
      urgency: 95,
      sources: [{ label: `${impact.equipment?.code ?? "Equipment"} issue`, href: `/exceptions/${impact.scenario.issueId}` }, { label: impact.scenario.shipmentNumber, href: "/shipments/gold" }],
    });
  } else if (impact && !impact.result.assessed) {
    insights.push({
      id: "production-not-assessed",
      kind: "production",
      title: "Impact not assessed",
      summary: `The effect of the ${impact.equipment?.name ?? "breakdown"} on production cannot be worked out yet.`,
      why: `Still needed: ${impact.result.missing.join(" and ") || "an outage estimate"}. Nothing is estimated until it is supplied.`,
      action: { label: "Add the estimate", href: `/exceptions/${impact.scenario.issueId}` },
      urgency: 60,
      sources: [{ label: "Issue", href: `/exceptions/${impact.scenario.issueId}` }],
    });
  }

  // 2. Shipment attention: a collection or fleet schedule waiting on a reply, or a declined request. The oldest planned date first.
  const waiting = inputs.shipments.filter((item) => item.state === "waiting" || item.state === "declined").sort((a, b) => a.preferredDate.localeCompare(b.preferredDate))[0];
  if (waiting) {
    const declined = waiting.state === "declined";
    const own = waiting.transportMode === "own_fleet";
    insights.push({
      id: `shipment-${waiting.id}`,
      kind: "shipment",
      title: "Shipment attention",
      summary: declined ? `${waiting.number}: the transporter declined the collection planned for ${shortDate(waiting.preferredDate)}.` : `${waiting.number} is awaiting ${own ? "the fleet schedule confirmation" : "transport confirmation"} for ${shortDate(waiting.preferredDate)}.`,
      why: "A request is not a booking: the shipment cannot be dispatched until transport is confirmed.",
      action: { label: declined ? "Choose transport" : own ? "Confirm schedule" : "Confirm transport", href: `/shipments/${waiting.id}` },
      urgency: declined ? 85 : 70,
      sources: [{ label: waiting.number, href: `/shipments/${waiting.id}` }],
    });
  }

  // 3a. Asset dependencies: an unavailable asset that other assets depend on (for example a substation feeding a crusher and a conveyor).
  // It names what is affected and does not estimate production or money: that only comes from a calculation that has been done.
  const failedWithDependents = inputs.equipment.filter((item) => !item.retiredAt && item.state === "unavailable" && item.dependents.length > 0).sort((a, b) => b.dependents.length - a.dependents.length)[0];
  if (failedWithDependents) {
    const affected = failedWithDependents.dependents;
    insights.push({
      id: `dependency-${failedWithDependents.id}`,
      kind: "equipment",
      title: "Dependent assets affected",
      summary: `${failedWithDependents.code} is reported unavailable. ${affected.map((item) => item.code).join(", ")} ${affected.length === 1 ? "depends" : "depend"} on it.`,
      why: "Assets that depend on it cannot run until it is back. No production or financial impact is estimated unless it has been calculated.",
      action: { label: "Open asset", href: `/equipment/${failedWithDependents.id}` },
      urgency: 88,
      sources: [{ label: failedWithDependents.code, href: `/equipment/${failedWithDependents.id}` }, ...affected.map((item) => ({ label: item.code, href: `/equipment/${item.id}` }))],
    });
  }

  // 3. Equipment reliability: only on evidence. Two or more recorded breakdowns is a recurrence; fewer is not claimed.
  const recurring = [...inputs.equipment].filter((item) => !item.retiredAt && breakdownCount(item) >= RECURRENCE_THRESHOLD).sort((a, b) => breakdownCount(b) - breakdownCount(a))[0];
  if (recurring) {
    insights.push({
      id: `reliability-${recurring.id}`,
      kind: "equipment",
      title: "Recurring breakdowns",
      summary: `${recurring.code} has been reported unavailable ${breakdownCount(recurring)} times on record.`,
      why: "Repeated reports on the same equipment suggest a cause worth fixing at the root. No failure prediction is made from this.",
      action: { label: "Review history", href: `/equipment/${recurring.id}` },
      urgency: 55,
      sources: [{ label: recurring.code, href: `/equipment/${recurring.id}` }],
    });
  }
  const overdue = inputs.equipment.find((item) => !item.retiredAt && item.nextService?.state === "overdue");
  if (overdue) {
    insights.push({
      id: `maintenance-${overdue.id}`,
      kind: "equipment",
      title: "Maintenance overdue",
      summary: `${overdue.code}: ${overdue.nextService?.name ?? "service"} is overdue (${overdue.nextService?.label ?? "overdue"}).`,
      why: "Overdue service can take the equipment out of use, including for loads planned on it.",
      action: { label: "Open equipment", href: `/equipment/${overdue.id}` },
      urgency: 58,
      sources: [{ label: overdue.code, href: `/equipment/${overdue.id}` }],
    });
  }

  // 4. Readiness: parts that may run short before they are due.
  const shortage = inputs.readiness.find((item) => item.status === "potential_shortage" || item.status === "overdue");
  if (shortage) {
    insights.push({
      id: `readiness-${shortage.id}`,
      kind: "readiness",
      title: shortage.status === "overdue" ? "Readiness overdue" : "Possible shortage",
      summary: `${shortage.title}: ${shortage.status === "overdue" ? "this is overdue" : "parts may run short before this is due"}.`,
      why: "Work that depends on this cannot start until it is ready.",
      action: { label: "Review readiness", href: `/resources/${shortage.id}` },
      urgency: shortage.status === "overdue" ? 75 : 50,
      sources: [{ label: shortage.title, href: `/resources/${shortage.id}` }],
    });
  }

  return insights.sort((a, b) => b.urgency - a.urgency);
}

// ---- Shift briefing ---------------------------------------------------------------------------------------------------------

export type BriefingLine = { id: string; text: string; href: string | null; tone: "good" | "attention" | "neutral" };

export type Briefing = {
  shiftId: string | null;
  shiftName: string;
  /** What the handover says now: nothing has been approved by this panel. */
  handoverState: "draft" | "published" | "acknowledged" | "none";
  lines: BriefingLine[];
  /** Recommended priorities for the next shift, from open issues and outstanding work. */
  nextShift: BriefingLine[];
  /** Everything here is generated from records. A supervisor reviews it; it is never published or approved automatically. */
  generated: true;
};

/** The shift's production figures as the Overview reports them: reported, not verified. */
export const REPORTED_PRODUCTION = { reportedTonnes: 156_200, targetTonnes: 162_000 } as const;

export function buildBriefing(inputs: Pick<IntelligenceInputs, "shifts" | "issues">): Briefing {
  const shift = inputs.shifts.find((item) => item.state === "in_progress") ?? inputs.shifts.find((item) => item.state === "scheduled") ?? inputs.shifts.at(-1) ?? null;
  const lines: BriefingLine[] = [];
  const { reportedTonnes, targetTonnes } = REPORTED_PRODUCTION;
  const pct = Math.round((reportedTonnes / targetTonnes) * 100);
  const fmt = (value: number) => new Intl.NumberFormat("en-GB").format(value);
  lines.push({ id: "production", text: `Production: ${fmt(reportedTonnes)} t reported (${pct}% of the ${fmt(targetTonnes)} t target). Reported, not verified.`, href: "/shifts/production", tone: pct >= 95 ? "good" : "attention" });

  if (shift) {
    const done = shift.work.filter((item) => item.done).length;
    lines.push({ id: "work", text: `Work completed: ${done} of ${shift.work.length} tasks.`, href: `/shifts/${shift.id}`, tone: done === shift.work.length ? "good" : "neutral" });
    const open = inputs.issues.filter(isOpen);
    lines.push({ id: "open", text: `Open items: ${open.length} operational issue${open.length === 1 ? "" : "s"} still open.`, href: "/exceptions", tone: open.length === 0 ? "good" : "attention" });
    const stateText = { draft: "The handover is still a draft and has not been sent.", published: "The handover has been sent and is waiting to be acknowledged.", acknowledged: "The handover has been acknowledged." }[shift.handover.state];
    lines.push({ id: "handover", text: stateText, href: `/shifts/${shift.id}/handover`, tone: shift.handover.state === "draft" ? "attention" : "good" });
  }

  const nextShift: BriefingLine[] = inputs.issues
    .filter(isOpen)
    .slice(0, 3)
    .map((issue) => ({ id: issue.id, text: `${issue.title}${issue.owner ? ` (${issue.owner})` : " (no owner yet)"}`, href: `/exceptions/${issue.id}`, tone: "attention" as const }));

  return { shiftId: shift?.id ?? null, shiftName: shift?.name ?? "No shift", handoverState: shift?.handover.state ?? "none", lines, nextShift, generated: true };
}

// ---- Reviewing and approving the briefing --------------------------------------------------------------------------------------

/** A supervisor's review of a generated briefing. The generated lines are never stored as the truth: a correction sits beside them. */
export type BriefingRecord = {
  shiftId: string;
  state: "draft" | "approved";
  /** Line id to the supervisor's corrected wording. */
  corrections: Record<string, string>;
  /** The supervisor's own note. It is theirs, not generated. */
  note: string;
  approvedBy: string | null;
  approvedAt: string | null;
  /** The generated wording at the moment of approval, so later changes in the records can be noticed. */
  approvedGenerated: Record<string, string> | null;
  history: { id: string; at: string; actor: string; summary: string }[];
};

/** Who may correct and approve a briefing. Everyone else reads it. */
const reviewerRoles = ["Shift Supervisor", "Mine Manager"];
export const canReviewBriefing = (actor: { role: string }) => reviewerRoles.includes(actor.role);
export const reviewMessage = "A briefing is reviewed and approved by a Shift Supervisor or the Mine Manager.";

export type BriefingLineView = BriefingLine & { generated: string; edited: boolean };

/** The briefing with any corrections applied. A corrected line says so. */
export function effectiveLines(briefing: Briefing, record: Pick<BriefingRecord, "corrections">): BriefingLineView[] {
  return briefing.lines.map((line) => {
    const corrected = record.corrections[line.id];
    return { ...line, generated: line.text, text: corrected ?? line.text, edited: corrected !== undefined && corrected !== line.text };
  });
}

/** Lines whose generated wording differs from what was approved: the records have changed since. */
export function changedSinceApproval(briefing: Briefing, record: Pick<BriefingRecord, "state" | "approvedGenerated">): string[] {
  if (record.state !== "approved" || !record.approvedGenerated) return [];
  const approved = record.approvedGenerated;
  return briefing.lines.filter((line) => approved[line.id] !== line.text).map((line) => line.id);
}

// ---- Ask VESPER -------------------------------------------------------------------------------------------------------------

export type Answer = {
  /** Which supported analysis answered, or "unsupported". */
  topic: "attention" | "target" | "recurring" | "downtime" | "shipments" | "value" | "shift_change" | "unsupported";
  text: string;
  /** Records the answer is based on. */
  links: { label: string; href: string }[];
  /** What could not be worked out and what is needed. Empty when nothing is missing. */
  missing: string[];
};

export const exampleQuestions = [
  "What requires my attention today?",
  "What is preventing us from achieving our production target?",
  "Which equipment has experienced recurring failures?",
  "What happens if this crusher remains unavailable for four hours?",
  "Which shipments are at risk?",
  "What is the estimated sales value affected by operational delays?",
  "What changed between the previous shift and the current shift?",
] as const;

const any = (question: string, ...words: string[]) => words.some((word) => question.includes(word));

/** Matches a question to a supported analysis. Unsupported questions say so instead of guessing. */
export function answerQuestion(rawQuestion: string, inputs: IntelligenceInputs): Answer {
  const question = rawQuestion.toLowerCase().trim();
  const insights = buildInsights(inputs);
  const { impact } = inputs;

  if (any(question, "attention", "need me", "priorit", "urgent", "first")) {
    if (insights.length === 0) return { topic: "attention", text: "Nothing on record needs attention right now.", links: [], missing: [] };
    return { topic: "attention", text: insights.slice(0, 3).map((item, index) => `${index + 1}. ${item.title}: ${item.summary}`).join(" "), links: insights.slice(0, 3).map((item) => ({ label: item.action.label, href: item.action.href })), missing: [] };
  }
  if (any(question, "recurring", "repeated", "repeat", "reliab", "keeps failing", "failures", "breakdowns")) {
    const list = inputs.equipment.filter((item) => !item.retiredAt).map((item) => ({ item, count: breakdownCount(item) })).filter(({ count }) => count >= RECURRENCE_THRESHOLD).sort((a, b) => b.count - a.count);
    if (list.length === 0) return { topic: "recurring", text: `No equipment has ${RECURRENCE_THRESHOLD} or more recorded breakdowns, so no recurring failure is claimed.`, links: [], missing: ["A longer breakdown history. VESPER does not predict failures without evidence."] };
    return { topic: "recurring", text: list.map(({ item, count }) => `${item.code} has been reported unavailable ${count} times.`).join(" "), links: list.map(({ item }) => ({ label: item.code, href: `/equipment/${item.id}` })), missing: [] };
  }
  if (any(question, "four hours", "4 hours", "remains unavailable", "stays unavailable", "if this", "what happens if", "what if")) {
    if (!impact) return { topic: "downtime", text: "There is no breakdown scenario to analyse right now.", links: [], missing: ["An open equipment breakdown with an outage estimate."] };
    const link = [{ label: "Open the scenario", href: `/exceptions/${impact.scenario.issueId}` }];
    if (!impact.result.assessed) return { topic: "downtime", text: `The effect on the ${formatGrams(impact.scenario.commitmentGrams)} gold delivery cannot be worked out yet.`, links: link, missing: impact.result.missing };
    return { topic: "downtime", text: `On the current estimate, ${impact.equipment?.name ?? "the equipment"} downtime could leave the ${formatGrams(impact.scenario.commitmentGrams)} delivery up to ${formatGrams(impact.result.remainingShortfallGrams ?? 0)} short. To compare outage lengths, change the scenario on the issue: the same calculation updates everywhere.`, links: link, missing: [] };
  }
  if (any(question, "sales value", "value affected", "financial", "rand", "worth", "delayed")) {
    if (!impact) return { topic: "value", text: "There is no operational delay with a calculated value right now.", links: [], missing: [] };
    if (!impact.canSeeValue) return { topic: "value", text: "Sales values are shown to the roles that may see them. Your role does not include that.", links: [], missing: [] };
    if (!impact.result.assessed || impact.result.valueDelayed === null) return { topic: "value", text: "The sales value potentially delayed cannot be worked out yet.", links: [{ label: "Open the scenario", href: `/exceptions/${impact.scenario.issueId}` }], missing: impact.result.missing };
    return { topic: "value", text: `The estimated sales value potentially delayed is ${formatMoney(impact.result.valueDelayed)}. This is a calculated estimate of what is at stake in a late delivery. It is not a confirmed loss, revenue or cash.`, links: [{ label: impact.scenario.shipmentNumber, href: "/shipments/gold" }], missing: [] };
  }
  if (any(question, "shipment", "deliver", "collection", "transport", "dispatch")) {
    const open = inputs.shipments.filter((item) => item.state === "waiting" || item.state === "declined");
    const lines = open.map((item) => `${item.number} (${shortDate(item.preferredDate)}): ${item.state === "declined" ? "transport declined" : "waiting for transport confirmation"}.`);
    if (impact?.result.assessed && (impact.result.remainingShortfallGrams ?? 0) > 0) lines.push(`${impact.scenario.shipmentNumber}: the gold delivery could be short by up to ${formatGrams(impact.result.remainingShortfallGrams ?? 0)}.`);
    if (lines.length === 0) return { topic: "shipments", text: "No shipment is waiting on transport, and none is flagged at risk.", links: [{ label: "Shipments", href: "/shipments" }], missing: [] };
    return { topic: "shipments", text: lines.join(" "), links: [...open.map((item) => ({ label: item.number, href: `/shipments/${item.id}` })), ...(impact ? [{ label: impact.scenario.shipmentNumber, href: "/shipments/gold" }] : [])], missing: [] };
  }
  if (any(question, "target", "prevent", "production", "behind", "shortfall")) {
    const production = insights.filter((item) => item.kind === "production" || item.kind === "equipment" || item.kind === "readiness");
    const { reportedTonnes, targetTonnes } = REPORTED_PRODUCTION;
    const head = `Reported production is ${new Intl.NumberFormat("en-GB").format(reportedTonnes)} t against a ${new Intl.NumberFormat("en-GB").format(targetTonnes)} t target (reported, not verified).`;
    if (production.length === 0) return { topic: "target", text: `${head} Nothing on record is currently holding it back.`, links: [{ label: "Production", href: "/shifts/production" }], missing: [] };
    return { topic: "target", text: `${head} What is holding it back: ${production.slice(0, 3).map((item) => item.summary).join(" ")}`, links: production.slice(0, 3).map((item) => ({ label: item.action.label, href: item.action.href })), missing: [] };
  }
  if (any(question, "changed", "previous shift", "last shift", "difference", "since")) {
    const briefing = buildBriefing(inputs);
    const shift = inputs.shifts.find((item) => item.id === briefing.shiftId);
    const previous = shift?.previous;
    if (!shift || !previous) return { topic: "shift_change", text: "There is no previous shift on record to compare with.", links: [], missing: ["A previous shift."] };
    return { topic: "shift_change", text: `Compared with ${previous.name}, ${shift.name}: ${briefing.lines.map((line) => line.text).join(" ")}`, links: [{ label: "Handover", href: `/shifts/${shift.id}/handover` }], missing: [] };
  }
  return {
    topic: "unsupported",
    text: "I can answer questions about what needs attention, what is holding back the production target, recurring equipment failures, the effect of an outage, shipments at risk, sales value affected, and what changed between shifts.",
    links: [],
    missing: [],
  };
}
